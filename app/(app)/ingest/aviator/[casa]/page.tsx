import ClientPage from './ClientPage';

export default function IngestAviatorPage({ params }: { params: { casa: string } }) {
  const casa = (params.casa || '').toLowerCase();

  return (
    <section className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Últimos sinais • Aviator • {casa}</h1>
      <ClientPage casa={casa} />
    </section>
  );
}
