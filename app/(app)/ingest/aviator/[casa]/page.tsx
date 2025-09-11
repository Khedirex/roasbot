// app/(app)/ingest/aviator/[casa]/page.tsx
import ChartAviator from "./ChartAviator";

export default async function Page({ params }: { params: { casa: string } }) {
  const casa = (params.casa || "").toLowerCase();
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Aviator • {casa}</h1>
      <ChartAviator casa={casa} />
    </div>
  );
}
