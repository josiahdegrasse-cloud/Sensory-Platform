-- Durable, tenant-scoped governance for literature used by Evidence Assist.
-- The NFI corpus was already attested by the owner; this migration records
-- that decision per document so review state survives serverless restarts.

CREATE TABLE public.literature_document_reviews (
  tenant_id text NOT NULL REFERENCES public.organizations(slug) ON DELETE RESTRICT,
  document_id text NOT NULL,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  peer_review_status text NOT NULL DEFAULT 'unknown'
    CHECK (peer_review_status IN ('peer_reviewed', 'not_peer_reviewed', 'unknown')),
  license_status text NOT NULL DEFAULT 'unknown'
    CHECK (license_status IN ('cleared', 'restricted', 'unknown')),
  review_basis text NOT NULL DEFAULT 'individual_review'
    CHECK (review_basis IN ('individual_review', 'nfi_corpus_attestation', 'bulk_review')),
  notes text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, document_id)
);

CREATE INDEX literature_document_reviews_status_idx
  ON public.literature_document_reviews (tenant_id, review_status, updated_at DESC);

ALTER TABLE public.literature_document_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.literature_document_reviews FROM anon, authenticated;

-- Persist the corpus-wide approval the owner already supplied. The scientific
-- classification stays conservative: attestation clears usage, but does not
-- claim that every indexed source is peer reviewed.
INSERT INTO public.literature_document_reviews (
  tenant_id,
  document_id,
  review_status,
  peer_review_status,
  license_status,
  review_basis,
  notes,
  reviewed_at
)
SELECT DISTINCT
  tenant_id,
  COALESCE(NULLIF(document_id, ''), source_path),
  'approved',
  'not_peer_reviewed',
  'cleared',
  'nfi_corpus_attestation',
  'Approved under the recorded NFI corpus rights attestation.',
  now()
FROM public.rag_chunks
ON CONFLICT (tenant_id, document_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.literature_document_reviews
  TO rag_service;

COMMENT ON TABLE public.literature_document_reviews IS
  'Durable per-document scientific review and usage-rights decisions for Evidence Assist.';
COMMENT ON COLUMN public.literature_document_reviews.review_basis IS
  'How the current decision was established; corpus attestation never implies peer review.';

DO $$
DECLARE
  indexed_count integer;
  governed_count integer;
BEGIN
  SELECT count(DISTINCT COALESCE(NULLIF(document_id, ''), source_path))
    INTO indexed_count
  FROM public.rag_chunks
  WHERE tenant_id = 'nfi';

  SELECT count(*)
    INTO governed_count
  FROM public.literature_document_reviews
  WHERE tenant_id = 'nfi';

  IF indexed_count <> governed_count THEN
    RAISE EXCEPTION
      'Literature governance backfill mismatch: % indexed documents, % review records',
      indexed_count,
      governed_count;
  END IF;
END
$$;
