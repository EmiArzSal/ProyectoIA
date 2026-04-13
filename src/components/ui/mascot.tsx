import Image from "next/image";
import { cn } from "@/lib/utils";

export type MascotVariant =
  | "idle"
  | "talking"
  | "thinking"
  | "cheering"
  | "sad"
  | "sleeping"
  | "motivating"
  | "studying"
  | "waving";

interface MascotProps {
  variant: MascotVariant;
  size?: number;
  className?: string;
}

export function Mascot({ variant, size = 120, className }: MascotProps) {
  return (
    <Image
      src={`/mascot/mascot_${variant}.svg`}
      alt="Mascota de Agora"
      width={size}
      height={size}
      className={cn("drop-shadow-sm select-none", className)}
      priority
    />
  );
}
