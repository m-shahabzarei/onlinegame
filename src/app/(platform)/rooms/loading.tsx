import { Skeleton } from "@/components/ui";
export default function LoadingRooms() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-6 px-4 py-12"
      role="status"
      aria-label="Loading room"
    >
      <Skeleton className="h-16" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
