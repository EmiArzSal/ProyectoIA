"use client";

import React, { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import {
  ArrowLeftIcon,
  CameraIcon,
  CheckCircle2Icon,
  CheckIcon,
  ImageUpIcon,
  LockKeyholeIcon,
  LogOutIcon,
  ShieldAlertIcon,
  Trash2Icon,
  XIcon,
  PenIcon
} from "lucide-react";
import { toast } from "sonner";

interface SettingsViewProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
    emailVerified?: boolean;
    createdAt?: Date | string;
  };
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_LENGTH = 350_000;
const AVATAR_DIMENSION = 512;

async function createAvatarDataUrl(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_DIMENSION;
  canvas.height = AVATAR_DIMENSION;

  const scale = Math.max(AVATAR_DIMENSION / bitmap.width, AVATAR_DIMENSION / bitmap.height);
  const sourceWidth = AVATAR_DIMENSION / scale;
  const sourceHeight = AVATAR_DIMENSION / scale;
  const sourceX = (bitmap.width - sourceWidth) / 2;
  const sourceY = (bitmap.height - sourceHeight) / 2;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("No se pudo procesar la imagen.");
  }

  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, AVATAR_DIMENSION, AVATAR_DIMENSION);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/webp", 0.8);
  if (dataUrl.length > MAX_COMPRESSED_IMAGE_LENGTH) {
    throw new Error("La imagen sigue siendo muy pesada. Prueba con una foto más sencilla.");
  }
  return dataUrl;
}

export const SettingsView = ({ user }: SettingsViewProps) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user.name || "");
  const [editingName, setEditingName] = useState(user.name || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user.image ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Elige una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("La imagen debe pesar menos de 5 MB.");
      return;
    }

    try {
      setAvatarPreview(await createAvatarDataUrl(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la imagen.");
    }
  };

  const handleSaveAvatar = async () => {
    if (!avatarPreview) return;
    setIsSavingAvatar(true);
    try {
      const result = await authClient.updateUser({ image: avatarPreview });
      if (result.error) {
        toast.error("No se pudo guardar la foto de perfil.");
        return;
      }
      setAvatarUrl(avatarPreview);
      setAvatarPreview(null);
      toast.success("Foto de perfil actualizada.");
    } catch {
      toast.error("No se pudo guardar la foto de perfil.");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleUpdateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = editingName.trim();
    if (!name) {
      toast.error("Escribe tu nombre para continuar.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const result = await authClient.updateUser({ name });
      if (result.error) {
        toast.error("No se pudo actualizar tu nombre.");
        return;
      }
      setDisplayName(name);
      setEditingName(name);
      setIsEditing(false);
      toast.success("Nombre actualizado.");
    } catch {
      toast.error("No se pudo actualizar tu nombre.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingName(displayName);
    setIsEditing(false);
  };

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        toast.error("No se pudo cerrar la sesión. Intenta de nuevo.");
        return;
      }
      router.push("/sign-in");
    } catch {
      toast.error("No se pudo cerrar la sesión. Intenta de nuevo.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation.trim().toUpperCase() !== "ELIMINAR" || !deletePassword) return;

    setIsDeletingAccount(true);
    try {
      const result = await authClient.deleteUser({ password: deletePassword });
      if (result.error) {
        toast.error("No se pudo eliminar la cuenta. Verifica tu contraseña e intenta de nuevo.");
        return;
      }

      setIsDeleteDialogOpen(false);
      toast.success("Tu cuenta y los datos asociados se eliminaron.");
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar la cuenta. Verifica tu contraseña e intenta de nuevo.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const createdDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Información no disponible";

  const currentAvatar = avatarPreview ?? avatarUrl;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="-ml-2 mb-6 gap-2 text-muted-foreground">
        <ArrowLeftIcon className="size-4" />
        Volver al dashboard
      </Button>

      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Configuración</h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Administra tu perfil y la sesión de Agora.
        </p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Tu información personal y foto de perfil.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
              {currentAvatar ? (
                <Avatar className="size-20 border-2 border-background shadow-sm">
                  <AvatarImage src={currentAvatar} alt={`Foto de perfil de ${displayName || user.email}`} />
                  <AvatarFallback>{displayName.slice(0, 1).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              ) : (
                <GeneratedAvatar seed={displayName || user.email} variant="initials" className="size-20 border-2 border-background shadow-sm" />
              )}

              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">Foto de perfil</p>
                <p className="text-sm text-muted-foreground">JPG, PNG o WebP. Máximo 5 MB; se ajusta a un recorte cuadrado.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleAvatarSelection}
                  aria-label="Seleccionar imagen de perfil"
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSavingAvatar} className="gap-2">
                    {avatarPreview ? <CameraIcon className="size-4" /> : <ImageUpIcon className="size-4" />}
                    {avatarPreview ? "Cambiar imagen" : "Subir imagen"}
                  </Button>
                  {avatarPreview && (
                    <>
                      <Button type="button" size="sm" onClick={handleSaveAvatar} disabled={isSavingAvatar} className="gap-2">
                        <CheckIcon className="size-4" />
                        {isSavingAvatar ? "Guardando…" : "Guardar foto"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarPreview(null)} disabled={isSavingAvatar}>
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </section>

            <Separator />

            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Nombre</Label>
                  <Input
                    id="profile-name"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    placeholder="Tu nombre"
                    maxLength={100}
                    autoComplete="name"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Correo electrónico</Label>
                  <div className="relative">
                    <Input id="profile-email" value={user.email} readOnly className="bg-muted/50 pr-10 text-muted-foreground" />
                    <LockKeyholeIcon className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">El correo de tu cuenta no se puede modificar.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={isSavingProfile || !editingName.trim()} className="gap-2">
                    <CheckIcon className="size-4" />
                    {isSavingProfile ? "Guardando…" : "Guardar cambios"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSavingProfile} className="gap-2">
                    <XIcon className="size-4" />
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-muted-foreground">Nombre</p>
                    <p className="font-medium">{displayName || "No configurado"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-muted-foreground">Correo electrónico</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-all font-medium">{user.email}</p>
                      {user.emailVerified ? (
                        <Badge variant="outline" className="gap-1 border-emerald-600/20 bg-emerald-50 text-emerald-700">
                          <CheckCircle2Icon className="size-3.5" />
                          Verificado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-600/20 bg-amber-50 text-amber-700">Pendiente</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Cuenta creada</p>
                    <p className="font-medium">{createdDate}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                  <PenIcon className="size-4" />
                  Editar nombre
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sesión</CardTitle>
            <CardDescription>Controla el acceso a tu cuenta en este dispositivo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium">Cerrar sesión</p>
              <p className="text-sm text-muted-foreground">Tendrás que iniciar sesión de nuevo para volver a entrar.</p>
            </div>
            <Button onClick={handleLogout} variant="outline" disabled={isSigningOut} className="shrink-0 gap-2">
              <LogOutIcon className="size-4" />
              {isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlertIcon className="size-5" />
              Zona de peligro
            </CardTitle>
            <CardDescription>Acciones que afectan permanentemente tu cuenta y tus datos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Al eliminar tu cuenta también se borrarán tus entrevistas, agentes, glosario y progreso. Esta acción no se puede deshacer.
              </p>
              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                  setIsDeleteDialogOpen(open);
                  if (!open && !isDeletingAccount) {
                    setDeletePassword("");
                    setDeleteConfirmation("");
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="shrink-0 gap-2">
                    <Trash2Icon className="size-4" />
                    Eliminar cuenta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar tu cuenta permanentemente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borrarán tu perfil, entrevistas, agentes, glosario, correcciones y progreso. Confirma con tu contraseña actual y escribe <strong>ELIMINAR</strong> para continuar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="delete-account-password">Contraseña actual</Label>
                      <Input
                        id="delete-account-password"
                        type="password"
                        autoComplete="current-password"
                        value={deletePassword}
                        onChange={(event) => setDeletePassword(event.target.value)}
                        disabled={isDeletingAccount}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="delete-account-confirmation">Confirmación</Label>
                      <Input
                        id="delete-account-confirmation"
                        value={deleteConfirmation}
                        onChange={(event) => setDeleteConfirmation(event.target.value)}
                        placeholder="ELIMINAR"
                        disabled={isDeletingAccount}
                      />
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingAccount}>Cancelar</AlertDialogCancel>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      isLoading={isDeletingAccount}
                      disabled={
                        !deletePassword ||
                        deleteConfirmation.trim().toUpperCase() !== "ELIMINAR"
                      }
                    >
                      Sí, eliminar mi cuenta
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
