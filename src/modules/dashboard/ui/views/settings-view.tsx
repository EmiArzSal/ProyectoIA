"use client";

import React, { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeftIcon, LogOutIcon, Trash2Icon, EditIcon, CheckIcon, XIcon } from "lucide-react";
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


export const SettingsView = ({ user }: SettingsViewProps) => {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(user.name || "");
  const [editingEmail, setEditingEmail] = useState(user.email);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      // Aquí iría la lógica para actualizar el perfil
      // Por ahora solo mostramos un toast
      toast.success("Perfil actualizado correctamente");
      setIsEditing(false);
    } catch {
      toast.error("Error al actualizar el perfil");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      // Aquí iría la lógica para eliminar la cuenta
      toast.success("Cuenta eliminada correctamente");
      // Redirigir a la página de inicio después de eliminar
      router.push("/");
    } catch {
      toast.error("Error al eliminar la cuenta");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleLogout = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
        },
      },
    });
  };

  return (
    <div className="flex-1 py-6 px-4 md:px-8 max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeftIcon className="size-4" />
        Volver al Dashboard
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Configuración de Cuenta</h1>
        <p className="text-muted-foreground mt-2">Administra tu información personal y configuración</p>
      </div>

      {/* Profile Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>Actualiza tu información de perfil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              {user.image ? (
                <Avatar className="size-20">
                  <AvatarImage src={user.image} alt={user.name || "Usuario"} />
                </Avatar>
              ) : (
                <GeneratedAvatar seed={user.name || user.email} variant="initials" className="size-20" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Foto de perfil</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tu avatar es generado automáticamente basado en tu nombre
              </p>
            </div>
          </div>

          {/* Edit Mode */}
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Tu nombre"
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={editingEmail}
                  onChange={(e) => setEditingEmail(e.target.value)}
                  type="email"
                  placeholder="tu@email.com"
                  className="mt-2"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={isLoading}
                  className="gap-2"
                  size="sm"
                >
                  <CheckIcon className="size-4" />
                  Guardar Cambios
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <XIcon className="size-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Nombre</p>
                <p className="text-base text-gray-900 mt-1">{user.name || "No configurado"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Email</p>
                <p className="text-base text-gray-900 mt-1">{user.email}</p>
                {user.emailVerified === true && (
                  <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    ✓ Verificado
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Cuenta creada</p>
                <p className="text-base text-gray-900 mt-1">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }) : "Información no disponible"}
                </p>
              </div>
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <EditIcon className="size-4" />
                Editar Información
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>entrevista </CardTitle>
          <CardDescription>Administra tu entrevista activa</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">Cierra tu entrevista en este dispositivo</p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOutIcon className="size-4" />
            Cerrar Sesión
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Zona de Peligro</CardTitle>
          <CardDescription>Acciones irreversibles</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Eliminar tu cuenta es permanente. Se eliminarán todos tus datos, entrevistas, glosarios, agentes y correcciones.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="gap-2"
              >
                <Trash2Icon className="size-4" />
                Eliminar Cuenta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminarán permanentemente tu cuenta y todos tus datos asociados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeletingAccount ? "Eliminando..." : "Eliminar Cuenta"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};
