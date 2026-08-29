import React, { useEffect, useState } from 'react';
import { fetchLeftovers, restoreProgram } from '../lib/api';

const LeftoverReview = () => {
  const [leftovers, setLeftovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadLeftovers = async () => {
      try {
        const data = await fetchLeftovers();
        setLeftovers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadLeftovers();
  }, []);

  const handleRestore = async (leftoverId) => {
    try {
      await restoreProgram(leftoverId);
      setLeftovers(leftovers.filter((leftover) => leftover.id !== leftoverId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div>Loading leftovers...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="leftover-review">
      <h2>Leftover Files</h2>
      {leftovers.length === 0 ? (
        <p>No leftover files found.</p>
      ) : (
        <ul>
          {leftovers.map((leftover) => (
            <li key={leftover.id} className="card">
              <h3>{leftover.name}</h3>
              <p>Path: {leftover.path}</p>
              <button onClick={() => handleRestore(leftover.id)}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LeftoverReview;