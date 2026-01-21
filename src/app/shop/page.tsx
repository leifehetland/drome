"use client";
import React from "react";
import Link from "next/link";
import { Film } from "lucide-react";

const products = [
  {
    title: "Gold Glass Christmas Ornament",
    price: "$12.00",
    url: "https://videodrome.tv/collections/all-merch/products/gold-glass-christmas-ornament",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/files/IMG_0341_c710cdda-460a-4c74-bd74-98388a610a35.jpg?v=1764369989",
  },
  {
    title: "Drome for the Holidays Snowglobe Ornament",
    price: "$6.00",
    url: "https://videodrome.tv/collections/all-merch/products/drome-for-the-holidays-snowglobe-ornament",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/files/IMG_7666.jpg?v=1764784924",
  },
  {
    title: "Black Long Sleeve T",
    price: "$35.00",
    url: "https://videodrome.tv/collections/all-merch/products/black-long-sleeve-t",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/files/IMG_7477.heic?v=1763915871",
  },
  {
    title: "Logo tee — Gold (Unisex)",
    price: "$25.00",
    url: "https://videodrome.tv/collections/all-merch/products/yellow-logo-tee",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/products/gold-tee.jpg?v=1664129749",
  },
  {
    title: "Mulholland Dr. Tote Bag",
    price: "$20.00",
    url: "https://videodrome.tv/collections/all-merch/products/mulholland-dr-tote-bag",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/files/IMG_6195.heic?v=1755722242",
  },
  {
    title: "Black Ghostface Tote Bag",
    price: "$20.00",
    url: "https://videodrome.tv/collections/all-merch/products/black-ghostface-tote-bag",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/products/IMG_2579.jpg?v=1755721917",
  },
  {
    title: "Samara Ringu Tote Bag",
    price: "$20.00",
    url: "https://videodrome.tv/collections/all-merch/products/samara-ringu-tote-bag",
    image:
      "https://videodrome.tv/cdn/shop/files/IMG_0354_360x.jpg?v=1764435579",
  },
  {
    title: "Logo T — Maroon (Unisex)",
    price: "$25.00",
    url: "https://videodrome.tv/collections/all-merch/products/logo-tee-maroon-unisex",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/files/IMG_6183.heic?v=1755722412",
  },
  {
    title: "$25 Gift Certificate - In-Store Use",
    price: "$25.00",
    url: "https://videodrome.tv/collections/all-merch/products/25-gift-certificate-for-20",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/products/IMG_5636.jpg?v=1609623410",
  },
  {
    title: "Halloween HAUSU T-Shirt",
    price: "$25.00",
    url: "https://videodrome.tv/collections/all-merch/products/halloween-2023-hausu-shirt-copy",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/files/IMG_6865.heic?v=1760558644",
  },
  {
    title: "Horror Icons T",
    price: "$25.00",
    url: "https://videodrome.tv/collections/all-merch/products/horror-icons-tee",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/files/IMG_6873.heic?v=1760558612",
  },
  {
    title: "Classic Logo Enamel Pin",
    price: "$5.00",
    url: "https://videodrome.tv/collections/all-merch/products/classic-logo-enamel-pin",
    image:
      "https://cdn.shopify.com/s/files/1/0280/3649/7443/files/IMG_2917.jpg?v=1736449750",
  },
];

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <img
            style={{ width: "100px" }}
            src="/images/white_logo.PNG"
            alt="VideoDrome Logo"
          />
          <div>
            <h1 className="text-3xl font-bold">Shop</h1>
            <p className="text-sm text-neutral-400">
              Official Videodrome merchandise
            </p>
          </div>
        </div>

        <div className="flex flex-wrap -mx-3 md:-mx-4">
          {products.map((p) => (
            <div
              key={p.title}
              className="flex-none w-1/2 sm:w-1/2 md:w-1/4 lg:w-1/4 px-3 md:px-4 box-border mb-6"
            >
              <div className="bg-neutral-800 rounded-lg overflow-hidden shadow-lg h-full flex flex-col">
                <div className="h-56 bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center overflow-hidden">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-neutral-500">No Image</div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-neutral-100 mb-1 line-clamp-2">
                      {p.title}
                    </h3>
                    <p className="text-xs text-neutral-400 mb-3">{p.price}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 bg-yellow-500 text-black text-center px-3 py-2 rounded-lg text-sm font-medium hover:bg-yellow-400 transition"
                    >
                      View
                    </a>
                    <button className="px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
