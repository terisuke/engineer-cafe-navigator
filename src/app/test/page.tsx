export default function TestPage() {
  return (
    <div className="min-h-screen bg-blue-500 p-8">
      <h1 className="text-4xl font-bold text-white mb-4">Tailwind CSS Test</h1>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <p className="text-gray-700 mb-4">If you can see this styled correctly, Tailwind is working!</p>
        <button className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded">
          Test Button
        </button>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="bg-red-500 p-4 rounded">Red</div>
        <div className="bg-green-500 p-4 rounded">Green</div>
        <div className="bg-blue-500 p-4 rounded">Blue</div>
      </div>
    </div>
  )
}
