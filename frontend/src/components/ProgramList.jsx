<div className="text-right">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-medium ${
                    { cyan: 'bg-[color:var(--accent-cyan)]/12 text-[color:var(--accent-cyan)]',
                      blue: 'bg-[color:var(--accent-blue)]/12 text-[color:var(--accent-blue)]',
                      amber: 'bg-[color:var(--warning)]/12 text-[color:var(--warning)]',
                      coral: 'bg-[color:var(--accent-coral)]/12 text-[color:var(--accent-coral)]'
                  }[sizeBadgeTone(program.sizeBytes)]
                }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatBytes(program.sizeBytes)}
                </span>
              </div>