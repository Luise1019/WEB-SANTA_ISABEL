export default function BudgetLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-14 rounded-lg bg-muted" />
      ))}
    </div>
  );
}
