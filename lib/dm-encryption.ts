const BACKUP_ITERATIONS = 310_000;
const MESSAGE_PREFIX = "e2ee:v1:";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type DmIdentity = {
  privateKey: CryptoKey;
  publicKey: string;
};

export type DmKeyBackup = {
  salt: string;
  iv: string;
  encryptedPrivateKey: string;
};

type CipherPart = { salt: string; iv: string; ciphertext: string };
type EncryptedMessage = {
  version: 1;
  senderId: string;
  recipientId: string;
  sender: CipherPart;
  recipient: CipherPart;
};

function toBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function cryptoApi() {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new Error("Bu tarayıcı güvenli mesaj şifrelemesini desteklemiyor.");
  }
  return globalThis.crypto;
}

async function parolaAnahtari(parola: string, salt: Uint8Array<ArrayBuffer>) {
  const api = cryptoApi();
  const malzeme = await api.subtle.importKey("raw", textEncoder.encode(parola), "PBKDF2", false, ["deriveKey"]);
  return api.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: BACKUP_ITERATIONS, hash: "SHA-256" },
    malzeme,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function yeniDmKimligiOlustur(parola: string): Promise<{ kimlik: DmIdentity; yedek: DmKeyBackup }> {
  const api = cryptoApi();
  const pair = await api.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = toBase64(await api.subtle.exportKey("raw", pair.publicKey));
  const privateKeyBytes = await api.subtle.exportKey("pkcs8", pair.privateKey);
  const privateKey = await api.subtle.importKey("pkcs8", privateKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const salt = api.getRandomValues(new Uint8Array(16));
  const iv = api.getRandomValues(new Uint8Array(12));
  const wrappingKey = await parolaAnahtari(parola, salt);
  const privateKeyJson = JSON.stringify({ publicKey, privateKey: toBase64(privateKeyBytes) });
  const encryptedPrivateKey = await api.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, textEncoder.encode(privateKeyJson));

  return {
    kimlik: { privateKey, publicKey },
    yedek: { salt: toBase64(salt), iv: toBase64(iv), encryptedPrivateKey: toBase64(encryptedPrivateKey) },
  };
}

export async function dmKimliginiKurtar(parola: string, yedek: DmKeyBackup): Promise<DmIdentity> {
  const api = cryptoApi();
  const salt = fromBase64(yedek.salt);
  const iv = fromBase64(yedek.iv);
  const wrappingKey = await parolaAnahtari(parola, salt);
  const decoded = await api.subtle.decrypt({ name: "AES-GCM", iv }, wrappingKey, fromBase64(yedek.encryptedPrivateKey));
  const payload = JSON.parse(textDecoder.decode(decoded)) as { publicKey: string; privateKey: string };
  const privateKey = await api.subtle.importKey("pkcs8", fromBase64(payload.privateKey), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  return { privateKey, publicKey: payload.publicKey };
}

function localDb(): Promise<IDBDatabase> {
  cryptoApi();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("knowledge-dm-keys", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("identities")) request.result.createObjectStore("identities");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Cihaz anahtarı açılamadı."));
  });
}

export async function cihazKimliginiSakla(userId: string, kimlik: DmIdentity) {
  const db = await localDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("identities", "readwrite");
    transaction.objectStore("identities").put(kimlik, userId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Anahtar bu cihazda saklanamadı."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Anahtar bu cihazda saklanamadı."));
  });
  db.close();
}

export async function cihazKimliginiOku(userId: string): Promise<DmIdentity | null> {
  const db = await localDb();
  const identity = await new Promise<DmIdentity | null>((resolve, reject) => {
    const request = db.transaction("identities", "readonly").objectStore("identities").get(userId);
    request.onsuccess = () => resolve((request.result as DmIdentity | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Cihaz anahtarı okunamadı."));
  });
  db.close();
  return identity;
}

async function mesajAnahtari(privateKey: CryptoKey, peerPublicKey: string, salt: Uint8Array<ArrayBuffer>, baglam: string) {
  const api = cryptoApi();
  const peerKey = await api.subtle.importKey("raw", fromBase64(peerPublicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = await api.subtle.deriveBits({ name: "ECDH", public: peerKey }, privateKey, 256);
  const keyMaterial = await api.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  new Uint8Array(secret).fill(0);
  return api.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: textEncoder.encode(baglam) },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function metniSifrele(plainText: string, privateKey: CryptoKey, peerPublicKey: string, baglam: string): Promise<CipherPart> {
  const api = cryptoApi();
  const salt = api.getRandomValues(new Uint8Array(16));
  const iv = api.getRandomValues(new Uint8Array(12));
  const key = await mesajAnahtari(privateKey, peerPublicKey, salt, baglam);
  const ciphertext = await api.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: textEncoder.encode(baglam) },
    key,
    textEncoder.encode(plainText)
  );
  return { salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

export async function dmMesajiniSifrele(plainText: string, senderId: string, recipientId: string, kimlik: DmIdentity, recipientPublicKey: string) {
  const senderContext = `knowledge-dm-v1|${senderId}|${recipientId}|sender`;
  const recipientContext = `knowledge-dm-v1|${senderId}|${recipientId}|recipient`;
  const envelope: EncryptedMessage = {
    version: 1,
    senderId,
    recipientId,
    sender: await metniSifrele(plainText, kimlik.privateKey, kimlik.publicKey, senderContext),
    recipient: await metniSifrele(plainText, kimlik.privateKey, recipientPublicKey, recipientContext),
  };
  return MESSAGE_PREFIX + toBase64(textEncoder.encode(JSON.stringify(envelope)));
}

export async function dmMesajiniCoz(content: string, myId: string, peerId: string, kimlik: DmIdentity, peerPublicKey: string) {
  if (!content.startsWith(MESSAGE_PREFIX)) return { content, encrypted: false };
  const envelope = JSON.parse(textDecoder.decode(fromBase64(content.slice(MESSAGE_PREFIX.length)))) as EncryptedMessage;
  if (envelope.version !== 1 || envelope.senderId === envelope.recipientId || ![envelope.senderId, envelope.recipientId].includes(myId) || ![envelope.senderId, envelope.recipientId].includes(peerId)) {
    throw new Error("Şifreli mesajın biçimi beklenenden farklı.");
  }
  const ownMessage = envelope.senderId === myId;
  const part = ownMessage ? envelope.sender : envelope.recipient;
  const context = `knowledge-dm-v1|${envelope.senderId}|${envelope.recipientId}|${ownMessage ? "sender" : "recipient"}`;
  const publicKey = ownMessage ? kimlik.publicKey : peerPublicKey;
  const key = await mesajAnahtari(kimlik.privateKey, publicKey, fromBase64(part.salt), context);
  const plain = await cryptoApi().subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(part.iv), additionalData: textEncoder.encode(context) },
    key,
    fromBase64(part.ciphertext)
  );
  return { content: textDecoder.decode(plain), encrypted: true };
}

export async function dmAnahtarParmakIzi(publicKey: string) {
  const digest = new Uint8Array(await cryptoApi().subtle.digest("SHA-256", fromBase64(publicKey)));
  return [...digest.slice(0, 16)].map((byte) => byte.toString(16).padStart(2, "0")).join("").match(/.{1,4}/g)?.join(" ").toUpperCase() ?? "";
}

export { MESSAGE_PREFIX };
