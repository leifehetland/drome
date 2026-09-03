"use client";
import React, { useState } from "react";
import { Film, User, Menu, X } from "lucide-react";

export default function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-black border-b border-neutral-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-3">
            <img
              style={{ width: "100px" }}
              src="/images/white_logo.PNG"
              alt="VideoDrome Logo"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-500">
                Atlanta's Video Store
              </h1>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-6">
            <a href="/films" className="text-md hover:text-yellow-500 transition">
              Browse
            </a>
            <a href="#" className="text-md hover:text-yellow-500 transition">
              New Releases
            </a>
            <a href="#" className="text-md hover:text-yellow-500 transition">
              Staff Picks
            </a>
            <a
              href="/shop"
              className="text-md hover:text-yellow-500 transition"
            >
              Shop
            </a>
            <a href="#" className="text-md hover:text-yellow-500 transition">
              My Rentals
            </a>
            <a
              href="/account"
              className="flex items-center space-x-2 bg-yellow-500 text-black px-4 py-2 rounded-lg text-md font-medium hover:bg-yellow-400 transition"
            >
              <User className="w-4 h-4" />
              <span>Account</span>
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-neutral-400"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-3 border-t border-neutral-800">
            <a
              href="/films"
              className="block text-md hover:text-yellow-500 transition"
            >
              Browse
            </a>
            <a
              href="#"
              className="block text-md hover:text-yellow-500 transition"
            >
              New Releases
            </a>
            <a
              href="/shop"
              className="block text-sm hover:text-yellow-500 transition"
            >
              Shop
            </a>
            <a
              href="#"
              className="block text-sm hover:text-yellow-500 transition"
            >
              Staff Picks
            </a>
            <a
              href="#"
              className="block text-sm hover:text-yellow-500 transition"
            >
              My Rentals
            </a>
            <a
              href="/account"
              className="w-full flex items-center justify-center space-x-2 bg-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-medium"
            >
              <User className="w-4 h-4" />
              <span>Account</span>
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
