import { createAvatar } from "@dicebear/core";
import { botttsNeutral, initials } from "@dicebear/collection";

interface Props {
  seed: string;
  variant?: "bottts" | "initials";
}

export const generateAvatarUri = ({ seed, variant = "bottts" }: Props) => {
  let avatar;
  if (variant === "bottts") {
    avatar = createAvatar(botttsNeutral, { seed });
  } else {
    avatar = createAvatar(initials, { seed, fontWeight: 500, fontSize: 42 });
  }
  return avatar.toDataUri();
};