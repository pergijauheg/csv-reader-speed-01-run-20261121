// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Same answer as csv-reader 1.0.0's readCsv for every input {text, header}:
// {columns, rows, errors}. Written from the competition's description of the
// reader's policy; the reference itself is only used to check the answers.
//
// Speed idea: the reference walks the text one character at a time and grows
// every field a character at a time. This one instead finds each field's end
// with native indexOf scans and takes the field with one slice, so a plain
// field costs a few native scans instead of a JS loop over its characters.
// The rare broken shapes (a stray CR inside a field, a quote that never
// closes, junk after a closing quote, a CR inside quotes) fall back to a
// small character loop that follows the reference step for step.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to
// the next. Every answer is deterministic, so two runs write the same bytes.

const COMMA = 0;
const BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Every error of the record carries these.
  let recordLine = 1;
  let recordRow = null;
  const err = (code) => {
    errors.push({ code, line: recordLine, row: recordRow });
  };

  // Slow unquoted scan from p with starting value val: a CR not followed by
  // LF is dropped (stray_cr); a quote inside is a literal character. Used
  // only where a field holds a stray CR, after a closing quote (junk), or
  // after a quote that never closes. Returns [value, ended, pos, added],
  // added counting the characters kept; `line` is updated in place.
  function slowUnquoted(p, val) {
    let added = 0;
    while (p < n) {
      const c = text.charCodeAt(p);
      if (c === 44) return [val, COMMA, p + 1, added]; // ,
      if (c === 10) {
        line += 1;
        return [val, BREAK, p + 1, added]; // LF
      }
      if (c === 13) {
        if (p + 1 < n && text.charCodeAt(p + 1) === 10) {
          line += 1;
          return [val, BREAK, p + 2, added]; // CRLF
        }
        err('stray_cr');
        p += 1;
        continue;
      }
      val += text[p];
      added += 1;
      p += 1;
    }
    return [val, END, p, added];
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended;
    let quoted = false;
    do {
      if (text.charCodeAt(pos) === 34) {
        // A field that opens with a quote.
        quoted = true;
        const open = pos;
        const openLine = line;
        // Find its closing quote: the next quote that is not doubled.
        let q = pos + 1;
        let closed = -1;
        let hasDouble = false;
        for (;;) {
          const qi = text.indexOf('"', q);
          if (qi === -1) break;
          if (qi + 1 < n && text.charCodeAt(qi + 1) === 34) {
            hasDouble = true;
            q = qi + 2;
            continue;
          }
          closed = qi;
          break;
        }
        if (closed === -1) {
          // The quote never closes: it is a literal character, and the
          // text after it is read again as unquoted.
          err('unterminated_quote');
          pos = open + 1;
          line = openLine;
          const r = slowUnquoted(open + 1, '"');
          fields.push(r[0]);
          ended = r[1];
          pos = r[2];
          continue;
        }
        // The quoted content, [open + 1, closed).
        let value;
        const crAt = text.indexOf('\r', open + 1);
        const hasCR = crAt !== -1 && crAt < closed;
        const lfAt = text.indexOf('\n', open + 1);
        const hasLF = lfAt !== -1 && lfAt < closed;
        if (!hasCR && !hasLF) {
          value = hasDouble
            ? text.slice(open + 1, closed).replaceAll('""', '"')
            : text.slice(open + 1, closed);
        } else {
          // Each CRLF or lone CR inside quotes is one LF, and each LF
          // inside quotes counts as a line too.
          let content = text.slice(open + 1, closed);
          let breaks = 0;
          for (let i = 0; i < content.length; i++) {
            const cc = content.charCodeAt(i);
            if (cc === 13) {
              breaks += 1;
              if (content.charCodeAt(i + 1) === 10) i += 1;
            } else if (cc === 10) {
              breaks += 1;
            }
          }
          line += breaks;
          if (hasCR) content = content.replace(/\r\n?/g, '\n');
          if (hasDouble) content = content.replaceAll('""', '"');
          value = content;
        }
        pos = closed + 1;
        if (pos >= n) {
          fields.push(value);
          ended = END;
        } else {
          const c = text.charCodeAt(pos);
          if (c === 44) {
            pos += 1;
            fields.push(value);
            ended = COMMA;
          } else if (c === 10) {
            pos += 1;
            line += 1;
            fields.push(value);
            ended = BREAK;
          } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
            pos += 2;
            line += 1;
            fields.push(value);
            ended = BREAK;
          } else {
            // What follows the closing quote is appended as it stands,
            // up to the next comma or line break.
            const r = slowUnquoted(pos, value);
            if (r[3] > 0) err('quote_junk');
            fields.push(r[0]);
            ended = r[1];
            pos = r[2];
          }
        }
      } else {
        // An unquoted field: find its end with native scans.
        quoted = false;
        const comma = text.indexOf(',', pos);
        const lf = text.indexOf('\n', pos);
        let end;
        if (comma === -1) {
          if (lf === -1) {
            end = n;
            ended = END;
          } else {
            end = lf;
            ended = BREAK;
          }
        } else if (lf === -1) {
          end = comma;
          ended = COMMA;
        } else if (comma < lf) {
          end = comma;
          ended = COMMA;
        } else {
          end = lf;
          ended = BREAK;
        }
        const cr = text.indexOf('\r', pos);
        if (cr !== -1 && cr < end && !(ended === BREAK && cr === end - 1)) {
          // A stray CR sits inside the field: take the slow path, which
          // drops it (stray_cr) and reads on.
          const r = slowUnquoted(pos, '');
          fields.push(r[0]);
          ended = r[1];
          pos = r[2];
        } else {
          // No stray CR: the field is one slice. A CR just before the
          // line break is the CRLF's own, not part of the field.
          let valueEnd = end;
          if (ended === BREAK) {
            line += 1;
            if (end > pos && text.charCodeAt(end - 1) === 13) valueEnd = end - 1;
          }
          fields.push(text.slice(pos, valueEnd));
          pos = ended === END ? end : end + 1;
        }
      }
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
