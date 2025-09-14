import ClientPage from './ClientPage';

export default async function IngestAviatorPage({
  params,
}: {
  params: Promise<{ casa: string }>;
}) {
  const { casa } = await params;
  const casaNormalized = (casa || '').toLowerCase();

  return (
    <section className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Últimos sinais • Aviator • {casaNormalized}</h1>
      <ClientPage casa={casaNormalized} />
    </section>
  );
}
