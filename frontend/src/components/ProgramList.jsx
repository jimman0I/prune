import React, { useEffect, useState } from 'react';
import { fetchPrograms, quarantineProgram } from '../lib/api';

const ProgramList = () => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPrograms = async () => {
      try {
        const data = await fetchPrograms();
        setPrograms(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPrograms();
  }, []);

  const handleQuarantine = async (programId) => {
    try {
      await quarantineProgram(programId);
      setPrograms(programs.filter((program) => program.id !== programId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div>Loading programs...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="program-list">
      <h2>Installed Programs</h2>
      {programs.length === 0 ? (
        <p>No programs found.</p>
      ) : (
        <ul>
          {programs.map((program) => (
            <li key={program.id} className="card">
              <h3>{program.name}</h3>
              <p>Version: {program.version}</p>
              <p>Path: {program.path}</p>
              <button onClick={() => handleQuarantine(program.id)}>
                Quarantine
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProgramList;