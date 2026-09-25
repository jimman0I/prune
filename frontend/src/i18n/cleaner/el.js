// Temporary hand-made fixture: the real generated file overwrites this one.
// Deliberately incomplete (3 rules, 2 categories) so the tests can prove the
// fall-back to the English in backend/src/data/cleaners.json.
export default {
  rules: {
    brave_cache: { name: 'Προσωρινή μνήμη', description: 'Αποθηκευμένες σελίδες και εικόνες. Ξαναδημιουργούνται καθώς περιηγείστε.' },
    brave_cookies: { name: 'Cookies', description: 'Σας αποσυνδέει από κάθε ιστότοπο που σας θυμόταν.' },
    chrome_cache: { name: 'Προσωρινή μνήμη', description: 'Αποθηκευμένες σελίδες και εικόνες του Chrome.' }
  },
  categories: {
    Brave: 'Πρόγραμμα περιήγησης Brave',
    Chrome: 'Πρόγραμμα περιήγησης Chrome'
  }
};
