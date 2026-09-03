"use client";
import { useState } from "react";
import { Search, Film, Calendar, MapPin, X } from "lucide-react";
import Nav from "@/components/Nav";


type Movie = {
  id: number;
  title: string;
  director: string;
  year: number;
  country: string;
  genre: string;
  availableCopies: number;
  totalCopies: number;
  formats: string[];
  coverImage: string;
};

const VideoDromeUI = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedFilm, setSelectedFilm] = useState<Movie | null>(null);

  // Sample film data with placeholder covers
  const films = [
    {
      id: 1,
      title: "Paris, Texas",
      director: "Wim Wenders",
      year: 1984,
      country: "West Germany/France/USA",
      genre: "Drama",
      availableCopies: 2,
      totalCopies: 3,
      formats: ["DVD", "Blu-ray", "4k"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/sP27Qm4THyRZyHjHYMfIDtJP6YE.jpg",
    },
    {
      id: 2,
      title: "Tampopo",
      director: "Juzo Itami",
      year: 1985,
      country: "Japan",
      genre: "Comedy",
      availableCopies: 1,
      totalCopies: 2,
      formats: ["DVD"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/ArYdSuX3zY9fMsE4LqmBl7xJq5R.jpg",
    },
    {
      id: 3,
      title: "Do the Right Thing",
      director: "Spike Lee",
      year: 1989,
      country: "USA",
      genre: "Drama",
      availableCopies: 0,
      totalCopies: 2,
      formats: ["DVD", "Blu-ray"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/63rmSDPahrH7C1gEFYzRuIBAN9W.jpg",
    },
    {
      id: 4,
      title: "Yi Yi",
      director: "Edward Yang",
      year: 2000,
      country: "Taiwan/Japan",
      genre: "Drama",
      availableCopies: 1,
      totalCopies: 1,
      formats: ["Blu-ray"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/mR8dSQZI8X6Z1NClJhFrtJp636z.jpg",
    },
    {
      id: 5,
      title: "The Thing",
      director: "John Carpenter",
      year: 1982,
      country: "USA",
      genre: "Horror/Sci-Fi",
      availableCopies: 3,
      totalCopies: 4,
      formats: ["DVD", "Blu-ray", "4K"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/tzGY49kseSE9QAKk47uuDGwnSCu.jpg",
    },
    {
      id: 6,
      title: "In the Mood for Love",
      director: "Wong Kar-wai",
      year: 2000,
      country: "Hong Kong",
      genre: "Romance/Drama",
      availableCopies: 2,
      totalCopies: 2,
      formats: ["DVD", "Blu-ray"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/m8jNwTP13ubYZyh5siVuyT9pZDp.jpg",
    },

    {
      id: 7,
      title: "Blade Runner",
      director: "Ridley Scott",
      year: 1982,
      country: "USA",
      genre: "Science Fiction",
      availableCopies: 1,
      totalCopies: 4,
      formats: ["DVD", "Blu-ray", "4k"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/63N9uy8nd9j7Eog2axPQ8lbr3Wj.jpg",
    },

    {
      id: 8,
      title: "Seven Samurai",
      director: "Akira Kurosawa",
      year: 1954,
      country: "Japan",
      genre: "Adventure",
      availableCopies: 3,
      totalCopies: 3,
      formats: ["DVD", "Blu-ray", "4k"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/8OKmBV5BUFzmozIC3pPWKHy17kx.jpg",
    },
    {
      id: 9,
      title: "The Seventh Seal",
      director: "Ingmar Bergman",
      year: 1957,
      country: "Sweden",
      genre: "Drama",
      availableCopies: 1,
      totalCopies: 2,
      formats: ["DVD", "Blu-ray"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/wcZ21zrOsy0b52AfAF50XpTiv75.jpg",
    },
    {
      id: 10,
      title: "Stalker",
      director: "Andrei Tarkovsky",
      year: 1979,
      country: "Soviet Union",
      genre: "Drama/Sci-Fi",
      availableCopies: 1,
      totalCopies: 2,
      formats: ["DVD", "Blu-ray"],
      coverImage:
        "https://www.themoviedb.org/t/p/w600_and_h900_face/1qhOyf5C4s9ZdvY8d5JDx9DFMeT.jpg",
    },
  ];

  const filters = [
    { id: "all", label: "All Films" },
    { id: "available", label: "Available Now" },
    { id: "drama", label: "Drama" },
    { id: "horror", label: "Horror" },
    { id: "international", label: "International" },
  ];

  const filteredFilms = films.filter((film) => {
    const matchesSearch =
      film.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      film.director.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      selectedFilter === "all" ||
      (selectedFilter === "available" && film.availableCopies > 0) ||
      film.genre.toLowerCase().includes(selectedFilter);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      {/* Header */}
      <Nav></Nav>

      {/* Hero Section with VHS Static */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-black"></div>

        {/* VHS Effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(https://i.giphy.com/3o6vXRxrhj7Ov94Gbu.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 py-16 md:py-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo */}
            <div className="mb-6 md:mb-8">
              <div className="inline-block relative">
                <img src="/images/white_logo.PNG" alt="VideoDrome Logo" />
                <h1
                  className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-yellow-500 mb-2"
                  style={{
                    textShadow:
                      "0 0 30px rgba(219, 237, 249, 0.6), 0 0 60px rgba(219, 237, 249, 0.4)",
                    fontFamily: "Impact, Arial Black, sans-serif",
                    letterSpacing: "0.05em",
                  }}
                ></h1>
                <p
                  className="text-lg md:text-2xl text-yellow-400 font-medium"
                  style={{
                    textShadow: "0 0 10px rgba(219, 237, 249, 0.5)",
                  }}
                >
                  Atlanta's Video Store
                </p>
              </div>
            </div>

            <p className="text-neutral-300 text-base md:text-xl mb-8 max-w-2xl mx-auto px-4">
              Explore our curated collection of ~30,000 films organized by
              director and country
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
              <div className="flex items-center gap-2 text-sm md:text-base text-neutral-300">
                <MapPin className="w-5 h-5 text-yellow-500" />
                <span>1023 N Highland Ave NE</span>
              </div>
              <div className="hidden sm:block text-neutral-600">•</div>
              <div className="flex items-center gap-2 text-sm md:text-base text-neutral-300">
                <Calendar className="w-5 h-5 text-yellow-500" />
                <span>Open 12pm-10pm Daily</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-neutral-900 to-transparent z-10" />
      </div>

      {/* Search Section */}
      <div className="bg-neutral-900 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 my-0 mx-auto text-center">
            Search Our Collection
          </h2>

          {/* Search Bar */}
          <div className="relative max-w-2xl my-0 mx-auto text-center">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by title, director, country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-12 pr-4 py-3 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedFilter === filter.id
                    ? "bg-yellow-500 text-black"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6 md:gap-4">
          <p className="text-neutral-400 text-sm">
            {filteredFilms.length}{" "}
            {filteredFilms.length === 1 ? "film" : "films"} found
          </p>
        </div>

        {/* Film Grid (flex-wrap replacement for grid) */}
        <div className="flex flex-wrap gap-2 md:gap-2 justify-center">
          {filteredFilms.map((film) => (
            <div
              key={film.id}
              onClick={() => setSelectedFilm(film)}
              className="group cursor-pointer w-4/5 sm:w-1/3 md:w-1/4 lg:w-1/5 gap-4 p-2"
            >
              <div className="relative aspect-[2/3] bg-neutral-800 rounded-lg overflow-hidden mb-3 shadow-lg">
                <img
                  src={film.coverImage}
                  alt={film.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {film.availableCopies === 0 && (
                  <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                      OUT
                    </span>
                  </div>
                )}
                {film.availableCopies > 0 && (
                  <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-md text-sm font-bold">
                    {film.availableCopies} left
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-xl mb-1 group-hover:text-yellow-500 transition line-clamp-2">
                {film.title}
              </h3>
              <p className="text-lg text-neutral-300">{film.director}</p>
              <p className="text-lg text-neutral-300">{film.year}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Film Detail Modal */}
      {selectedFilm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedFilm(null)}
        >
          <div
            className="bg-neutral-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:flex">
              <div className="md:w-1/3 p-6">
                <img
                  src={selectedFilm.coverImage}
                  alt={selectedFilm.title}
                  className="w-full rounded-lg shadow-xl"
                />
              </div>
              <div className="md:w-2/3 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-3xl font-bold mb-2">
                      {selectedFilm.title}
                    </h2>
                    <p className="text-neutral-400">
                      Directed by {selectedFilm.director}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFilm(null)}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center space-x-2 text-sm">
                    <Calendar className="w-4 h-4 text-yellow-500" />
                    <span>{selectedFilm.year}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className="w-4 h-4 text-yellow-500" />
                    <span>{selectedFilm.country}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Film className="w-4 h-4 text-yellow-500" />
                    <span>{selectedFilm.genre}</span>
                  </div>
                </div>

                <div className="bg-neutral-800 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold mb-3">Availability</h3>
                  <div className="space-y-2">
                    {selectedFilm.formats.map((format) => (
                      <div
                        key={format}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm text-neutral-300">
                          {format}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            selectedFilm.availableCopies > 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {selectedFilm.availableCopies > 0
                            ? `${selectedFilm.availableCopies} of ${selectedFilm.totalCopies} available`
                            : "All copies out"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  {selectedFilm.availableCopies > 0 ? (
                    <>
                      <button className="flex-1 bg-yellow-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition">
                        Reserve for Pickup
                      </button>
                      <button className="px-6 py-3 border border-neutral-700 rounded-lg hover:bg-neutral-800 transition">
                        Add to Watchlist
                      </button>
                    </>
                  ) : (
                    <button className="flex-1 bg-neutral-800 text-neutral-400 px-6 py-3 rounded-lg font-semibold cursor-not-allowed">
                      Currently Unavailable
                    </button>
                  )}
                </div>

                <p className="text-xs text-neutral-500 mt-4">
                  Call (404) 885-1117 or visit us at 1023 N Highland Ave NE
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoDromeUI;
