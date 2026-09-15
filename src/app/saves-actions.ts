"use server";

import { auth } from "@/auth";
import { addSave, removeSave, removeSaveByRef } from "@/db/queries";
import { revalidatePath } from "next/cache";

function parseRef(formData: FormData) {
  const kind = String(formData.get("kind")) === "hold" ? "hold" : "watchlist";
  const tmdbId = formData.get("tmdbId") ? Number(formData.get("tmdbId")) : null;
  const mediaType = (formData.get("mediaType") as string) || null;
  const title = (formData.get("title") as string) || null;
  return { kind, tmdbId, mediaType, title };
}

export async function saveFilm(formData: FormData) {
  const uid = (await auth())?.user?.id;
  if (!uid) return;
  const { kind, tmdbId, mediaType, title } = parseRef(formData);
  await addSave(Number(uid), { tmdbId, mediaType, title, kind });
  revalidatePath("/account");
  revalidatePath("/films/detail");
}

export async function unsaveFilmByRef(formData: FormData) {
  const uid = (await auth())?.user?.id;
  if (!uid) return;
  const { kind, tmdbId, mediaType } = parseRef(formData);
  await removeSaveByRef(Number(uid), { tmdbId, mediaType, kind });
  revalidatePath("/account");
  revalidatePath("/films/detail");
}

export async function removeSaveById(formData: FormData) {
  const uid = (await auth())?.user?.id;
  if (!uid) return;
  await removeSave(Number(uid), Number(formData.get("id")));
  revalidatePath("/account");
}
