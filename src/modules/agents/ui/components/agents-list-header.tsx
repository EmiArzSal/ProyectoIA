"use client";

export const AgentListHeader = () => {
  return (
    <div className="py-4 px-4 md:px-8 flex flex-col gap-y-1">
      <h5 className="font-medium text-xl">Entrevistadores disponibles</h5>
      <p className="text-sm text-muted-foreground">
        Selecciona un agente para comenzar una entrevista de práctica.
      </p>
    </div>
  );
};
