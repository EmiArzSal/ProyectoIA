"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LibraryIcon,
  PlusIcon,
  Trash2Icon,
  AlertCircleIcon,
  XIcon,
  SearchIcon,
  LoaderIcon,
  CheckIcon,
  BookOpenIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DictionaryResult, DictionaryLookupResponse } from "@/app/api/dictionary/lookup/route";
import { Volume2Icon } from "lucide-react";

// ── Flashcard ────────────────────────────────────────────────────────────────

function Flashcard({
  id,
  term,
  definition,
  onRemove,
}: {
  id: string;
  term: string;
  definition: string;
  onRemove: (id: string) => void;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="h-56 cursor-pointer"
      style={{ perspective: "1000px" }}
      onClick={() => setFlipped((v) => !v)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front — term */}
        <div
          className="absolute inset-0 rounded-xl border bg-white flex flex-col items-center justify-center gap-2 p-6 shadow-sm hover:shadow-md transition-shadow select-none"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "translateZ(0.1px)" }}
        >
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Término
          </p>
          <p className="text-base font-semibold text-gray-800 text-center leading-snug break-words w-full">
            {term}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2">Toca para ver definición</p>
        </div>

        {/* Back — definition */}
        <div
          className="absolute inset-0 rounded-xl border bg-primary/5 border-primary/20 flex flex-col items-center justify-center gap-2 p-6 shadow-sm select-none"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg) translateZ(0.1px)",
          }}
        >
          <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest">
            Definición
          </p>
          <p className="text-base font-semibold text-gray-800 text-center leading-snug break-words w-full">
            {definition}
          </p>
          <button
            className="absolute bottom-3 right-3 text-[11px] text-muted-foreground hover:text-red-500 transition-colors flex gap-1 shrink-0"
            onClick={(e) => { e.stopPropagation(); onRemove(id); }}
          >
            <Trash2Icon className="size-3" /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add flashcard form ────────────────────────────────────────────────────────

function AddFlashcardForm({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");

  const create = useMutation(
    trpc.glossary.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.glossary.getMany.queryOptions());
        toast.success("Entrada agregada al glosario.");
        onClose();
      },
    })
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (term.trim() && definition.trim()) create.mutate({ term, definition }); }}
      className="rounded-xl border bg-white p-5 flex flex-col gap-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Nueva flashcard</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-gray-700">
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-600">Término</label>
        <Input placeholder="ej. Closure, Virtual DOM, REST..." value={term} onChange={(e) => setTerm(e.target.value)} maxLength={200} autoFocus />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-600">Definición</label>
        <Textarea placeholder="Explícalo con tus propias palabras..." value={definition} onChange={(e) => setDefinition(e.target.value)} maxLength={1000} rows={3} className="resize-none" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={!term.trim() || !definition.trim() || create.isPending}>Guardar</Button>
      </div>
    </form>
  );
}

// ── Flashcards tab ────────────────────────────────────────────────────────────

function FlashcardsTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery(trpc.glossary.getMany.queryOptions());
  const remove = useMutation(trpc.glossary.remove.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(trpc.glossary.getMany.queryOptions()),
  }));

  const filtered = search.trim()
    ? data.filter((e) => e.term.toLowerCase().includes(search.toLowerCase()) || e.definition.toLowerCase().includes(search.toLowerCase()))
    : data;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {data.length > 4 && (
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        )}
        <Button size="sm" className="gap-1.5 ml-auto" onClick={() => setShowForm(true)} disabled={showForm}>
          <PlusIcon className="size-4" /> Nueva entrada
        </Button>
      </div>

      {showForm && <AddFlashcardForm onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 rounded-xl border bg-white animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <AlertCircleIcon className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {search ? "Sin resultados para esa búsqueda." : "Aún no tienes flashcards. ¡Agrega tu primera entrada!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <Flashcard key={e.id} id={e.id} term={e.term} definition={e.definition} onRemove={(id) => remove.mutate({ id })} />
          ))}
        </div>
      )}

      {data.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">{data.length} {data.length === 1 ? "entrada" : "entradas"}</p>
      )}
    </div>
  );
}

// ── POS badge ─────────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  noun:       "bg-blue-100 text-blue-700",
  verb:       "bg-emerald-100 text-emerald-700",
  adjective:  "bg-amber-100 text-amber-700",
  adverb:     "bg-violet-100 text-violet-700",
  pronoun:    "bg-pink-100 text-pink-700",
  preposition:"bg-orange-100 text-orange-700",
};

function PosBadge({ pos }: { pos: string }) {
  const cls = POS_COLORS[pos] ?? "bg-gray-100 text-gray-600";
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", cls)}>{pos}</span>;
}

// ── Dictionary tab ────────────────────────────────────────────────────────────

function DictionaryTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [word, setWord] = useState("");
  const [lang] = useState<"en">("en");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DictionaryResult[] | null>(null);
  const [phonetic, setPhonetic] = useState<string | undefined>();
  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<DictionaryResult | null>(null);
  const [customDef, setCustomDef] = useState("");

  const { data: entries = [], isLoading: entriesLoading } = useQuery(trpc.dictionary.getMany.queryOptions());

  const create = useMutation(
    trpc.dictionary.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.dictionary.getMany.queryOptions());
        toast.success(`"${word}" guardado en tu diccionario.`);
        setWord("");
        setResults(null);
        setPhonetic(undefined);
        setAudioUrl(undefined);
        setNotFound(false);
        setSelected(null);
        setCustomDef("");
      },
    })
  );

  const remove = useMutation(
    trpc.dictionary.remove.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.dictionary.getMany.queryOptions()),
    })
  );

  const handleLookup = async () => {
    const trimmed = word.trim();
    if (!trimmed) return;
    setLoading(true);
    setResults(null);
    setPhonetic(undefined);
    setAudioUrl(undefined);
    setNotFound(false);
    setSelected(null);
    setCustomDef("");
    try {
      const res = await fetch(`/api/dictionary/lookup?word=${encodeURIComponent(trimmed)}&lang=${lang}`);
      const data = await res.json() as DictionaryLookupResponse;
      if (data.found && data.results.length > 0) {
        setResults(data.results);
        setPhonetic(data.phonetic);
        setAudioUrl(data.audioUrl);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const def = selected ? selected.definition : customDef.trim();
    if (!def || !word.trim()) return;
    create.mutate({
      word: word.trim(),
      definition: def,
      partOfSpeech: selected?.partOfSpeech,
      phonetic,
      audioUrl,
      language: lang,
    });
  };

  // Group entries by letter
  const grouped = entries.reduce<Record<string, typeof entries>>((acc, e) => {
    const l = e.letter;
    if (!acc[l]) acc[l] = [];
    acc[l].push(e);
    return acc;
  }, {});
  const letters = Object.keys(grouped).sort();

  function setLang(l: string) {
    throw new Error("Function not implemented.");
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Search panel ── */}
      <div className="rounded-xl border bg-white p-5 flex flex-col gap-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-800">Buscar palabra</p>

        {/* Language toggle */}
        <div className="flex gap-2">
          {(["en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => { setLang(l); setResults(null); setNotFound(false); setSelected(null); }}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                lang === l
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              🇺🇸 Inglés
            </button>
          ))}
        </div>

        {/* Word input */}
        <div className="flex gap-2">
          <Input
            placeholder="ej. closure, refactor, abstraction..."
            value={word}
            onChange={(e) => { setWord(e.target.value); setResults(null); setNotFound(false); setSelected(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            maxLength={100}
            className="flex-1"
          />
          <Button onClick={handleLookup} disabled={!word.trim() || loading} className="gap-1.5 shrink-0">
            {loading ? <LoaderIcon className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
            Buscar
          </Button>
        </div>

        {/* Results */}
        {results && (
          <div className="flex flex-col gap-2">
            {/* Word header with phonetic + audio */}
            <div className="flex items-center gap-3">
              <p className="text-base font-bold text-gray-800">{word.trim()}</p>
              {phonetic && (
                <span className="text-sm text-muted-foreground font-mono">{phonetic}</span>
              )}
              {audioUrl && (
                <button
                  type="button"
                  onClick={() => new Audio(audioUrl).play()}
                  className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  title="Escuchar pronunciación"
                >
                  <Volume2Icon className="size-4" />
                </button>
              )}
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Selecciona un significado
            </p>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(selected?.definition === r.definition ? null : r)}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 flex flex-col gap-1.5 transition-colors",
                    selected?.definition === r.definition
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {r.partOfSpeech && <PosBadge pos={r.partOfSpeech} />}
                    {selected?.definition === r.definition && (
                      <CheckIcon className="size-3.5 text-primary ml-auto shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.definition}</p>
                  {r.example && (
                    <p className="text-xs text-muted-foreground italic">&quot;{r.example}&quot;</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Not found — manual input */}
        {notFound && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-amber-600 font-medium">
              No se encontró &quot;{word}&quot; en el diccionario. Puedes escribir tu propia definición:
            </p>
            <Textarea
              placeholder="Escribe la definición manualmente..."
              value={customDef}
              onChange={(e) => setCustomDef(e.target.value)}
              rows={3}
              className="resize-none"
              maxLength={2000}
            />
          </div>
        )}

        {/* Save button */}
        {(selected || (notFound && customDef.trim())) && (
          <Button onClick={handleSave} disabled={create.isPending} className="self-end gap-1.5">
            <CheckIcon className="size-4" />
            Guardar en mi diccionario
          </Button>
        )}
      </div>

      {/* ── Saved entries — alphabetical ── */}
      {entriesLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border bg-white animate-pulse" />
          ))}
        </div>
      ) : letters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
          <BookOpenIcon className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Tu diccionario está vacío.<br />Busca una palabra arriba para empezar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {letters.map((letter) => (
            <div key={letter}>
              {/* Letter header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl font-bold text-primary/60 w-8 shrink-0">{letter}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Words under this letter */}
              <div className="flex flex-col gap-2 pl-11">
                {grouped[letter].map((e) => (
                  <div key={e.id} className="rounded-xl border bg-white p-4 flex gap-3 group hover:shadow-sm transition-shadow">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-800 text-sm">{e.word}</span>
                        {e.phonetic && (
                          <span className="text-xs text-muted-foreground font-mono">{e.phonetic}</span>
                        )}
                        {e.audioUrl && (
                          <button
                            type="button"
                            onClick={() => new Audio(e.audioUrl!).play()}
                            className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                            title="Escuchar pronunciación"
                          >
                            <Volume2Icon className="size-3.5" />
                          </button>
                        )}
                        {e.partOfSpeech && <PosBadge pos={e.partOfSpeech} />}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{e.definition}</p>
                    </div>
                    <button
                      onClick={() => remove.mutate({ id: e.id })}
                      className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 self-start mt-0.5"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center">
            {entries.length} {entries.length === 1 ? "palabra" : "palabras"} en tu diccionario
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function GlossaryView() {
  return (
    <div className="flex-1 py-6 px-4 md:px-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <LibraryIcon className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Glosario personal</h1>
          <p className="text-sm text-muted-foreground">Flashcards y diccionario para estudiar a tu ritmo</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="flashcards">
        <TabsList className="rounded-none bg-transparent border-b w-full justify-start h-auto p-0 gap-0">
          {[
            { value: "flashcards", label: "Flashcards" },
            { value: "dictionary", label: "Diccionario" },
          ].map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary text-muted-foreground data-[state=active]:text-foreground h-10 px-4 text-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="flashcards" className="mt-6">
          <FlashcardsTab />
        </TabsContent>
        <TabsContent value="dictionary" className="mt-6">
          <DictionaryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
