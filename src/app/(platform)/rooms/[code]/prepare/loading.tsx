import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div
      className="mx-auto grid max-w-6xl gap-6 px-4 py-8"
      role="status"
      aria-label="Loading session preparation"
    >
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-96" />
    </div>
  );
}
