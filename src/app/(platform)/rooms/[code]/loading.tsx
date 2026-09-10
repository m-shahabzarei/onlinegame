import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div
      className="mx-auto grid max-w-6xl gap-6 px-4 py-8"
      role="status"
      aria-label="Loading lobby"
    >
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
