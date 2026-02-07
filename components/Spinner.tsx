import React from 'react';

const Spinner = () => (
  <div className="flex flex-col items-center justify-center p-8">
    <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
    <p className="mt-4 text-brand-600 font-medium animate-pulse">Analyzing document...</p>
  </div>
);

export default Spinner;
