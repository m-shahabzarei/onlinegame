import { Card, CardContent, CardHeader, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main
      id="main-content"
      className="mx-auto min-h-dvh w-full max-w-screen-2xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16 2xl:px-12"
      aria-busy="true"
      aria-label="Loading page"
    >
      <Card className="min-h-72" variant="elevated">
        <CardHeader>
          <Skeleton className="h-5 w-36" radius="full" />
          <Skeleton className="mt-5 h-10 w-full max-w-xl" />
          <Skeleton className="mt-2 h-5 w-full max-w-2xl" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 w-full" radius="lg" />
          <Skeleton className="h-44 w-full" radius="lg" />
          <Skeleton className="hidden h-44 w-full lg:block" radius="lg" />
        </CardContent>
      </Card>
    </main>
  );
}
