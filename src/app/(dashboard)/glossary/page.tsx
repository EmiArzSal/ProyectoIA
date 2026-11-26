import { GlossaryView } from "@/modules/glossary/ui/views/glossary-view";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

// ?tab=dictionary opens the dictionary (linked from the dashboard's first steps).
export default async function GlossaryPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  return <GlossaryView initialTab={tab === "dictionary" ? "dictionary" : "flashcards"} />;
}
