import { Card, Skeleton } from "@/components/ui";

export default function ProfileLoading() {
  return (
    <section
      className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)] lg:px-8"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <Card className="min-h-[30rem] p-6 sm:p-8" variant="elevated">
        <Skeleton className="h-4 w-32" radius="full" />
        <Skeleton className="mt-5 h-10 w-64" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <div className="mt-8 grid gap-5">
          <Skeleton className="h-12 w-full" radius="md" />
          <Skeleton className="h-12 w-full" radius="md" />
          <Skeleton className="h-28 w-full" radius="md" />
        </div>
      </Card>
      <Card className="min-h-64 p-6" variant="subtle">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-4 h-5 w-full" />
      </Card>
    </section>
  );
}
