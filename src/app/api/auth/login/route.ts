// The old magic-link endpoint is retired. Password login uses Supabase Auth;
// accounts are provisioned exclusively by the administrator, never by this app.
export async function POST() {
  return Response.json(
    { error: "Logga in med mejladress och lösenord på inloggningssidan." },
    { status: 410 },
  );
}
