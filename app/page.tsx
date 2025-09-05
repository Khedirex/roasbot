export default function Home() {
  return (
    <section className="space-y-6">
      <h2 className="text-3xl font-bold">Visão Geral</h2>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-gray-500">Investimento</h3>
          <p className="text-2xl font-bold">R$ 5.000</p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-gray-500">Receita</h3>
          <p className="text-2xl font-bold">R$ 12.500</p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-gray-500">ROAS</h3>
          <p className="text-2xl font-bold text-green-600">2.5x</p>
        </div>
      </div>
    </section>
  );
}

