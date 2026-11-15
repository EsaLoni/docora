"""Table Intelligence Service.

Provides table extraction from document pages, column statistics, row filtering,
outlier and anomaly detection, and cross-document table comparison.
Preserves original table values, numbers, and units without silent modification.
"""

import math
import re
from typing import Any, Dict, List, Optional, Tuple

from app.services.intelligence.models import (
    ColumnStatistics,
    TableAnalysisResult,
)


class TableIntelligenceService:
    """Analytical engine for tabular data embedded in documents."""

    @staticmethod
    def extract_tables_from_markdown(text: str) -> List[Dict[str, Any]]:
        """Parses markdown tables (| col1 | col2 |) from raw text."""
        tables = []
        lines = [line.strip() for line in text.split("\n")]
        current_table_lines: List[str] = []

        for line in lines:
            if line.startswith("|") and line.endswith("|"):
                current_table_lines.append(line)
            else:
                if len(current_table_lines) >= 2:
                    table = TableIntelligenceService._parse_markdown_table_block(current_table_lines)
                    if table:
                        tables.append(table)
                current_table_lines = []

        if len(current_table_lines) >= 2:
            table = TableIntelligenceService._parse_markdown_table_block(current_table_lines)
            if table:
                tables.append(table)

        return tables

    @staticmethod
    def _parse_markdown_table_block(lines: List[str]) -> Optional[Dict[str, Any]]:
        """Parses a contiguous block of markdown table lines."""
        if len(lines) < 2:
            return None

        # Clean pipe edges
        def split_row(row_str: str) -> List[str]:
            cells = row_str.strip("|").split("|")
            return [c.strip() for c in cells]

        headers = split_row(lines[0])
        separator = lines[1]
        if not re.match(r"^[\s|:-]+$", separator):
            # Not a standard table separator
            return None

        rows = []
        for row_line in lines[2:]:
            cells = split_row(row_line)
            # Pad or trim to match header length
            if len(cells) < len(headers):
                cells += [""] * (len(headers) - len(cells))
            elif len(cells) > len(headers):
                cells = cells[: len(headers)]
            rows.append(cells)

        return {"headers": headers, "rows": rows}

    @staticmethod
    def analyze_table(
        headers: List[str],
        rows: List[List[Any]],
        page_number: int = 1,
        table_index: int = 0,
    ) -> TableAnalysisResult:
        """Computes column-level statistics, missing cells, summary, and numerical outliers."""
        row_count = len(rows)
        col_count = len(headers)
        missing_cells_count = 0
        columns_stats: List[ColumnStatistics] = []
        outliers: List[Dict[str, Any]] = []

        for col_idx, header in enumerate(headers):
            col_values = [row[col_idx] if col_idx < len(row) else None for row in rows]
            clean_values = []
            numeric_values: List[float] = []
            missing_count = 0

            for r_idx, val in enumerate(col_values):
                if val is None or str(val).strip() == "" or str(val).strip().lower() in ["na", "n/a", "null", "-", "none"]:
                    missing_count += 1
                else:
                    str_val = str(val).strip()
                    clean_values.append(str_val)
                    # Attempt numeric parsing without altering original units
                    parsed_num = TableIntelligenceService._try_parse_numeric(str_val)
                    if parsed_num is not None:
                        numeric_values.append(parsed_num)

            missing_cells_count += missing_count
            non_null_count = len(clean_values)
            unique_count = len(set(clean_values))

            # Determine column data type
            if non_null_count == 0:
                dtype = "empty"
            elif len(numeric_values) == non_null_count and non_null_count > 0:
                dtype = "numeric"
            else:
                dtype = "text"

            min_val = min(numeric_values) if numeric_values else None
            max_val = max(numeric_values) if numeric_values else None
            sum_val = sum(numeric_values) if numeric_values else None
            avg_val = (sum_val / len(numeric_values)) if numeric_values else None

            # Outlier detection for numeric series (IQR method if N >= 4)
            if len(numeric_values) >= 4:
                col_outliers = TableIntelligenceService._detect_iqr_outliers(
                    numeric_values, header, rows, col_idx
                )
                outliers.extend(col_outliers)

            columns_stats.append(
                ColumnStatistics(
                    column_name=header,
                    data_type=dtype,
                    count=row_count,
                    non_null_count=non_null_count,
                    missing_count=missing_count,
                    unique_count=unique_count,
                    min_value=min_val,
                    max_value=max_val,
                    avg_value=round(avg_val, 2) if avg_val is not None else None,
                    sum_value=round(sum_val, 2) if sum_val is not None else None,
                )
            )

        summary = (
            f"Table on page {page_number} with {row_count} rows and {col_count} columns "
            f"({', '.join(headers[:4])}{'...' if len(headers) > 4 else ''}). "
            f"Contains {missing_cells_count} missing cell(s)."
        )

        return TableAnalysisResult(
            table_index=table_index,
            page_number=page_number,
            headers=headers,
            row_count=row_count,
            col_count=col_count,
            summary=summary,
            columns=columns_stats,
            missing_cells_count=missing_cells_count,
            outliers=outliers,
        )

    @staticmethod
    def filter_rows(
        headers: List[str],
        rows: List[List[Any]],
        column_name: str,
        operator: str,
        value: Any,
    ) -> List[List[Any]]:
        """Filters rows according to column criteria: equals, contains, gt, lt."""
        if column_name not in headers:
            return rows

        col_idx = headers.index(column_name)
        filtered = []

        for row in rows:
            if col_idx >= len(row):
                continue
            cell_val = row[col_idx]
            match = False

            if operator == "equals":
                match = str(cell_val).strip().lower() == str(value).strip().lower()
            elif operator == "contains":
                match = str(value).strip().lower() in str(cell_val).strip().lower()
            elif operator in ["gt", "greater_than", ">"]:
                num_cell = TableIntelligenceService._try_parse_numeric(str(cell_val))
                num_target = TableIntelligenceService._try_parse_numeric(str(value))
                if num_cell is not None and num_target is not None:
                    match = num_cell > num_target
            elif operator in ["lt", "less_than", "<"]:
                num_cell = TableIntelligenceService._try_parse_numeric(str(cell_val))
                num_target = TableIntelligenceService._try_parse_numeric(str(value))
                if num_cell is not None and num_target is not None:
                    match = num_cell < num_target
            else:
                match = True

            if match:
                filtered.append(row)

        return filtered

    @staticmethod
    def compare_tables(
        table_a: Dict[str, Any],
        table_b: Dict[str, Any],
        doc_a_name: str = "Document A",
        doc_b_name: str = "Document B",
        key_column: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Compares two tables across documents by matching key column rows and identifying value differences."""
        headers_a = table_a.get("headers", [])
        rows_a = table_a.get("rows", [])
        headers_b = table_b.get("headers", [])
        rows_b = table_b.get("rows", [])

        differences = []

        # Find matching key column (first common text column or explicit key)
        common_cols = [c for c in headers_a if c in headers_b]
        if not common_cols:
            differences.append({
                "category": "Table Structure",
                "doc_a_value": f"Columns: {', '.join(headers_a)}",
                "doc_b_value": f"Columns: {', '.join(headers_b)}",
                "explanation": "No matching column headers found between tables.",
                "status": "conflicting",
            })
            return differences

        match_key = key_column if key_column in common_cols else common_cols[0]
        key_idx_a = headers_a.index(match_key)
        key_idx_b = headers_b.index(match_key)

        map_b = {str(r[key_idx_b]).strip().lower(): r for r in rows_b if key_idx_b < len(r)}

        for r_a in rows_a:
            if key_idx_a >= len(r_a):
                continue
            key_val = str(r_a[key_idx_a]).strip()
            key_lower = key_val.lower()

            if key_lower not in map_b:
                differences.append({
                    "category": f"Row Existence ({match_key})",
                    "doc_a_value": key_val,
                    "doc_b_value": "Missing",
                    "explanation": f"Row '{key_val}' present in {doc_a_name} but missing in {doc_b_name}.",
                    "status": "missing",
                })
            else:
                r_b = map_b[key_lower]
                # Compare overlapping columns
                for col in common_cols:
                    if col == match_key:
                        continue
                    c_idx_a = headers_a.index(col)
                    c_idx_b = headers_b.index(col)
                    val_a = str(r_a[c_idx_a]).strip() if c_idx_a < len(r_a) else ""
                    val_b = str(r_b[c_idx_b]).strip() if c_idx_b < len(r_b) else ""

                    if val_a != val_b:
                        differences.append({
                            "category": f"Table Value: {col} for '{key_val}'",
                            "doc_a_value": val_a,
                            "doc_b_value": val_b,
                            "explanation": f"For row '{key_val}', {col} differs: '{val_a}' vs '{val_b}'.",
                            "status": "conflicting",
                        })

        return differences

    @staticmethod
    def _try_parse_numeric(val: str) -> Optional[float]:
        """Strips currency symbols and commas to check for numeric representation."""
        cleaned = re.sub(r"[^\d.-]", "", val)
        if not cleaned or cleaned in ["-", ".", "-."]:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None

    @staticmethod
    def _detect_iqr_outliers(
        numbers: List[float],
        col_name: str,
        rows: List[List[Any]],
        col_idx: int,
    ) -> List[Dict[str, Any]]:
        """IQR outlier detection."""
        sorted_nums = sorted(numbers)
        n = len(sorted_nums)
        q1 = sorted_nums[n // 4]
        q3 = sorted_nums[(3 * n) // 4]
        iqr = q3 - q1
        if iqr == 0:
            return []
        lower_bound = q1 - (1.5 * iqr)
        upper_bound = q3 + (1.5 * iqr)

        outliers = []
        for r_idx, row in enumerate(rows):
            if col_idx < len(row):
                raw = str(row[col_idx]).strip()
                val = TableIntelligenceService._try_parse_numeric(raw)
                if val is not None and (val < lower_bound or val > upper_bound):
                    outliers.append({
                        "column": col_name,
                        "row_index": r_idx + 1,
                        "value": raw,
                        "reason": f"Value {val} outside normal range [{lower_bound:.2f}, {upper_bound:.2f}]",
                    })
        return outliers
