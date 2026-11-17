import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { errorBody, lookupDictionary, parseLookupQuery } from "@/modules/dictionary/server/lookup";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    return NextResponse.json(errorBody("AUTH_UNAVAILABLE", "No se pudo validar tu sesión."), { status: 503 });
  }
  if (!session) {
    return NextResponse.json(errorBody("UNAUTHORIZED", "Inicia sesión para consultar el diccionario."), { status: 401 });
  }

  const query = parseLookupQuery(req.nextUrl.searchParams);
  if (!query.success) {
    return NextResponse.json(query.response, { status: query.status });
  }

  const result = await lookupDictionary(query.data.word, query.data.lang);
  return NextResponse.json(result.body, { status: result.status });
}
