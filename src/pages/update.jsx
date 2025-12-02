import React from 'react';
import { useNavigate } from 'react-router-dom';

// --- UPDATE DATA ---
// Add new updates here. They will be automatically sorted by date (newest first).
const updatesList = [
  {
    date: '2025-11-05',
    title: 'Feedback Support Added',
    description:
      'We’ve introduced a brand-new Feedback page! You can now easily share your thoughts, suggestions, or report any issues directly within CODESPACEXO. Your input helps us improve faster and shape upcoming features.',
  },
  {
    date: '2025-11-03',
    title: 'File & Folder Renaming',
    description:
      'You can now rename files and folders! Just right-click on any item to open the context menu and select "Rename". This works recursively, meaning all files and sub-folders inside a renamed folder will also have their paths updated.',
  },
  {
    date: '2025-11-01',
    title: 'Added "What\'s New" Page',
    description:
      'Launched this "What\'s New" page to keep you informed about all the latest features, bug fixes, and improvements to CODESPACEXO.',
  },
  {
    date: '2025-10-28',
    title: 'Smarter Date Sorting',
    description:
      'Folders and files containing dates in their names (e.g., "Oct 25" or "12-Nov") are now automatically sorted chronologically at the end of the list, allowing you to see time-based items in order.',
  },
  {
    date: '2025-10-22',
    title: 'Data-Sync & Healing',
    description:
      'Implemented a new data-healing mechanism. If your file exists in storage but is missing its database entry (e.g., from a partial upload), the app will now automatically detect and heal the missing data when you load the folder.',
  },
];

// Helper function to format the date
const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

export default function Update() {
  const navigate = useNavigate();

  // Sort the updates by date, newest first
  const sortedUpdates = React.useMemo(
    () => updatesList.sort((a, b) => new Date(b.date) - new Date(a.date)),
    []
  );

  // --- FIX: Scroll to top on page load ---
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      {/* --- Global scrollbar hide --- */}
      <style>{`
        /* Hide scrollbar globally for Chrome, Safari, Edge */
        ::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
        ::-webkit-scrollbar-thumb {
          background: transparent;
        }
        /* Hide scrollbar for Firefox */
        html {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        html, body {
          overflow-y: scroll;
          scrollbar-gutter: stable;
        }
      `}</style>

      <div className="min-h-screen w-full bg-black text-white font-doto p-6 md:p-12 flex flex-col items-center">
        <div className="w-full max-w-4xl">
          {/* --- Back Button (Centered on mobile, left-aligned on desktop) --- */}
          <div className="w-full flex justify-center md:justify-start">
            <button
              onClick={() => navigate(-1)}
              className="font-doto font-bold mb-10 px-8 py-2 rounded-full bg-transparent text-white text-lg transition pointer-events-auto border border-white hover:bg-white hover:text-black"
            >
              Go Back
            </button>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-12 text-center text-white/90">
            What's New in CODESPACEXO
          </h1>

          <div className="space-y-10 text-white/80 text-lg md:text-xl">
            {/* --- Map over sorted updates --- */}
            {sortedUpdates.map((update) => (
              <div
                key={update.date}
                className="p-6 border border-gray-700 rounded-lg bg-gray-900/50"
              >
                {/* --- Date --- */}
                <p className="text-sm text-yellow-400 mb-2">
                  {formatDate(update.date)}
                </p>

                {/* --- Title --- */}
                <h2 className="text-2xl md:text-3xl font-semibold mb-3 text-white">
                  {update.title}
                </h2>

                {/* --- Description --- */}
                <p className="text-white/70 leading-relaxed">
                  {update.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
