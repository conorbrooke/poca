import { Suspense } from "react";
import { CategoryClient } from "./category-client";

type PageProps = {
  params: Promise<{ categoryId: string }>;
};

export default async function CategorySpendingPage({ params }: PageProps) {
  const { categoryId } = await params;

  return (
    <div className="page">
      <Suspense
        fallback={
          <div className="empty-state">
            <div className="loading-spinner" style={{ margin: "0 auto 1rem" }} />
            <p>Loading…</p>
          </div>
        }
      >
        <CategoryClient categoryId={categoryId} />
      </Suspense>
    </div>
  );
}
