import { Suspense } from "react";
import { TagDetailClient } from "./tag-detail-client";

type PageProps = {
  params: Promise<{ tagId: string }>;
};

export default async function TagDetailPage({ params }: PageProps) {
  const { tagId } = await params;

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
        <TagDetailClient tagId={tagId} />
      </Suspense>
    </div>
  );
}
