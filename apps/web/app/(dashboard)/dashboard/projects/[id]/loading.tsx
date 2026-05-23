export default function ProjectLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-8 w-56 rounded-lg bg-muted" />
        <div className="h-8 w-24 rounded-lg bg-muted ml-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 rounded-xl bg-muted" />
        <div className="h-40 rounded-xl bg-muted" />
      </div>
      <div className="h-96 rounded-xl bg-muted" />
    </div>
  );
}
