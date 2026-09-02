import { Suspense } from "react";
import { CategoryClient } from "../../spending/[categoryId]/category-client";

type PageProps = {
  params: Promise<{ categoryId: string }>;
};

export default async function CategoryIncomePage({ params }: PageProps) {
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
