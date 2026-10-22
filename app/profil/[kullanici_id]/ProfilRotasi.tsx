"use client";

import { use } from "react";
import ProfilKatkilari from "./ProfilKatkilari";

export default function ProfilRotasi({
  params,
}: {
  params: Promise<{ kullanici_id: string }>;
}) {
  const { kullanici_id } = use(params);
  return <ProfilKatkilari kullaniciId={kullanici_id} />;
}
