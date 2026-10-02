import assert from "node:assert/strict";
import test from "node:test";
import { publicEditorialCardImage } from "./publicPages.js";

test("news card uses the full-resolution asset for a separate thumbnail", () => {
  const item = {
    imageUrl: "https://example.com/article.jpg",
    thumbnail_url: "https://example.com/card-web.webp",
    thumbnail_media_asset_id: "card-asset"
  };
  const assets = [{
    id: "card-asset",
    file_path_original_url: "https://example.com/card-original.webp",
    file_path_web_url: "https://example.com/card-web.webp",
    file_path_thumb_url: "https://example.com/card-thumb.webp",
    image_width: 1536,
    web_image_width: 1350,
    thumb_image_width: 640
  }];

  const image = publicEditorialCardImage(item, assets);
  assert.equal(image.url, assets[0].file_path_original_url);
  assert.match(image.srcset, /card-original\.webp 1536w/);
  assert.match(image.srcset, /card-web\.webp 1350w/);
  assert.doesNotMatch(image.srcset, /card-thumb\.webp/);
});

test("news card keeps the article image when no separate thumbnail exists", () => {
  const articleUrl = "https://example.com/article.jpg";
  assert.equal(publicEditorialCardImage({ imageUrl: articleUrl, thumbnail_url: articleUrl }).url, articleUrl);
});

test("news card honors a separate thumbnail URL without a matching media asset", () => {
  const image = publicEditorialCardImage({
    imageUrl: "https://example.com/article.jpg",
    thumbnail_url: "https://example.com/card.jpg",
    mediaAssetId: "article-asset"
  }, [{ id: "article-asset", file_path_original_url: "https://example.com/article.jpg", image_width: 1536 }]);
  assert.equal(image.url, "https://example.com/card.jpg");
  assert.equal(image.srcset, "");
});
