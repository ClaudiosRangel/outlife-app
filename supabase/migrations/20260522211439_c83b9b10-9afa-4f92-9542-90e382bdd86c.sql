
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_rating_range_check CHECK (rating BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE public.reviews VALIDATE CONSTRAINT reviews_rating_range_check;
