import { nanoid } from "nanoid";
import slugifyPkg from "slugify";

const slugify = (slugifyPkg as any).default || slugifyPkg;

export function generateInviteCode(): string {
  return nanoid(12);
}

export function createSlug(text: string): string {
  return slugify(text, { lower: true, strict: true });
}
