-- 2026-11-11: the business sells custom-design photo frames and resin
-- (glue-art) frames, not cosmetics or eyewear (OPEN_QUESTIONS #19).
-- Adds the frame categories, then retires the old seeded categories, but only
-- those that hold no products, so no real data is ever hidden.
INSERT INTO "categories" ("name", "slug", "description", "is_customizable", "is_featured", "sort_order")
VALUES
  ('Photo Frames', 'photo-frames', 'Wooden, metal and classic frames for your favourite photos.', true, true, 0),
  ('Custom Photo Frames', 'custom-photo-frames', 'Your photo, names and dates, printed and framed.', true, true, 1),
  ('Resin Art Frames', 'resin-art-frames', 'Handmade resin and glue-art frames with flowers, glitter and keepsakes.', true, true, 2),
  ('Collage Frames', 'collage-frames', 'Many memories in one frame.', true, true, 3),
  ('Name & Quote Frames', 'name-quote-frames', 'Names, meanings and quotes, beautifully lettered.', true, false, 4),
  ('Wall Frames', 'wall-frames', 'Gallery sets and statement frames for your walls.', false, false, 5),
  ('Table-top Frames', 'table-top-frames', 'Desk and shelf frames that stand on their own.', false, false, 6),
  ('Gift Frames', 'gift-frames', 'Ready-to-gift frames for birthdays, anniversaries and festivals.', true, false, 7)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
UPDATE "categories" c
   SET "is_active" = false, "is_featured" = false, "deleted_at" = now(), "updated_at" = now()
 WHERE c."slug" IN ('cosmetics', 'customized-cosmetics', 'eyeglass-frames', 'sunglasses', 'designer-frames', 'premium-frames', 'accessories', 'customized-accessories')
   AND c."deleted_at" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "products" p WHERE p."category_id" = c."id" AND p."deleted_at" IS NULL);
