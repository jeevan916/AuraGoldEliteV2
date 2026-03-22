import React from 'react';
import { useLiveRatesREST } from '../hooks/useLiveRatesStream';

export default function LiveRatesDisplay() {
  const { rates, loading, error } = useLiveRatesREST();

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (loading || !rates) {
    return <div>Loading live rates...</div>;
  }

  return (
    <div className="p-4 border rounded-xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Live Rates (Last updated: {new Date(rates.timestamp).toLocaleTimeString()})</h2>
      
      <h3 className="text-lg font-medium">Gold</h3>
      <ul className="mb-4">
        {rates.goldRates.map(rate => (
          <li key={rate.id} className="text-sm">
            {rate.name}: Ask ₹{rate.ask.toFixed(2)} / Bid ₹{rate.bid.toFixed(2)}
          </li>
        ))}
      </ul>

      <h3 className="text-lg font-medium">Silver</h3>
      <ul>
        {rates.silverRates.map(rate => (
          <li key={rate.id} className="text-sm">
            {rate.name}: Ask ₹{rate.ask.toFixed(2)} / Bid ₹{rate.bid.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}
