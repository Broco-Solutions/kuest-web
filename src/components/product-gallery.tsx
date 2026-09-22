"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatPrice, type Product } from "@/data/products";

type ProductGalleryProps = { products: Product[] };

export function ProductGallery({ products }: ProductGalleryProps) {
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!activeProduct) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveProduct(null);
      if (event.key === "ArrowRight" && activeProduct.images.length > 1) {
        setActiveImage((current) => (current + 1) % activeProduct.images.length);
      }
      if (event.key === "ArrowLeft" && activeProduct.images.length > 1) {
        setActiveImage((current) => (current - 1 + activeProduct.images.length) % activeProduct.images.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeProduct]);

  const openProduct = (product: Product) => {
    setActiveProduct(product);
    setActiveImage(0);
  };

  const moveImage = (direction: 1 | -1) => {
    if (!activeProduct || activeProduct.images.length < 2) return;
    setActiveImage((current) => (current + direction + activeProduct.images.length) % activeProduct.images.length);
  };

  return (
    <>
      <div className="product-rail" id="all-models">
        {products.map((product, index) => (
          <article className="product-card" key={product.slug}>
            <button className="product-image" type="button" onClick={() => openProduct(product)} aria-label={`View ${product.name} images`}>
              <Image src={product.images[0]} alt={`${product.name} ${product.eyebrow}`} fill sizes="(max-width: 768px) 85vw, 33vw" />
              <span className="product-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="product-arrow"><span className="arrow" aria-hidden="true">↗</span></span>
              <span className="product-view-hint">Open view</span>
            </button>
            <div className="product-meta">
              <div><p>{product.eyebrow}</p><h3>{product.name}</h3></div>
              <strong>{formatPrice(product.price)}</strong>
            </div>
          </article>
        ))}
      </div>

      {activeProduct && (
        <div className="product-lightbox" role="dialog" aria-modal="true" aria-label={`${activeProduct.name} image viewer`} onClick={() => setActiveProduct(null)}>
          <div className="product-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <button className="lightbox-close" type="button" onClick={() => setActiveProduct(null)} aria-label="Close image viewer">×</button>
            <div className="lightbox-stage">
              <Image key={`${activeProduct.slug}-${activeImage}`} src={activeProduct.images[activeImage]} alt={`${activeProduct.name} enlarged view ${activeImage + 1}`} fill sizes="(max-width: 800px) 94vw, 82vw" className="lightbox-image" priority />
              <span className="lightbox-counter" aria-live="polite">{String(activeImage + 1).padStart(2, "0")} / {String(activeProduct.images.length).padStart(2, "0")}</span>
              {activeProduct.images.length > 1 && (
                <>
                  <button className="lightbox-nav lightbox-prev" type="button" onClick={() => moveImage(-1)} aria-label="Previous product image">←</button>
                  <button className="lightbox-nav lightbox-next" type="button" onClick={() => moveImage(1)} aria-label="Next product image">→</button>
                </>
              )}
            </div>
            <div className="lightbox-meta"><span>{activeProduct.eyebrow}</span><h3>{activeProduct.name}</h3><strong>{formatPrice(activeProduct.price)}</strong></div>
            {activeProduct.images.length > 1 && <div className="lightbox-thumbs" aria-label="Product images">{activeProduct.images.map((image, index) => <button className={`lightbox-thumb${index === activeImage ? " is-active" : ""}`} type="button" key={image} onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1}`}><Image src={image} alt="" fill sizes="64px" /></button>)}</div>}
          </div>
        </div>
      )}
    </>
  );
}
