"""Unit Tests for Multi-Stage File Upload Validator."""

import pytest
from app.core.config import Settings
from app.core.exceptions import IngestionValidationError
from app.services.storage.validator import FileValidator


@pytest.fixture
def validator():
    settings = Settings(MAX_UPLOAD_SIZE_BYTES=1024 * 1024 * 5)  # 5 MB
    return FileValidator(settings)


def test_valid_pdf_validation(validator):
    """Verify legitimate PDF file passes validation."""
    content = b"%PDF-1.4\nTest PDF body content\n%%EOF"
    res = validator.validate("financial_report.pdf", content)
    assert res.sanitized_filename == "financial_report.pdf"
    assert res.extension == ".pdf"
    assert res.mime_type == "application/pdf"
    assert res.file_size_bytes == len(content)
    assert len(res.file_hash) == 64  # SHA-256


def test_valid_docx_and_xlsx_validation(validator):
    """Verify DOCX and XLSX files with PK zip headers pass."""
    docx_bytes = b"PK\x03\x04" + b"X" * 100
    res_docx = validator.validate("contract.docx", docx_bytes)
    assert res_docx.extension == ".docx"
    assert "wordprocessingml" in res_docx.mime_type

    xlsx_bytes = b"PK\x03\x04" + b"Y" * 100
    res_xlsx = validator.validate("budget.xlsx", xlsx_bytes)
    assert res_xlsx.extension == ".xlsx"
    assert "spreadsheetml" in res_xlsx.mime_type


def test_valid_csv_and_txt_validation(validator):
    """Verify plain text and CSV files pass."""
    csv_bytes = b"id,name,amount\n1,Alice,100\n2,Bob,200\n"
    res_csv = validator.validate("data.csv", csv_bytes)
    assert res_csv.extension == ".csv"
    assert res_csv.mime_type == "text/csv"

    txt_bytes = b"Simple document text with no binary nulls."
    res_txt = validator.validate("notes.txt", txt_bytes)
    assert res_txt.extension == ".txt"
    assert res_txt.mime_type == "text/plain"


def test_empty_file_rejected(validator):
    """Verify 0-byte file raises IngestionValidationError."""
    with pytest.raises(IngestionValidationError) as exc_info:
        validator.validate("empty.pdf", b"")
    assert "empty" in exc_info.value.message.lower()


def test_oversized_file_rejected(validator):
    """Verify file exceeding size limit is rejected."""
    oversized = b"%PDF-" + b"A" * (1024 * 1024 * 6)  # 6 MB > 5 MB
    with pytest.raises(IngestionValidationError) as exc_info:
        validator.validate("huge.pdf", oversized)
    assert "exceeds" in exc_info.value.message.lower()


def test_mime_spoofing_rejected(validator):
    """Verify file claiming to be PDF but having plain text/binary bytes is rejected."""
    fake_pdf = b"This is just plain text masquerading as a PDF file."
    with pytest.raises(IngestionValidationError) as exc_info:
        validator.validate("fake.pdf", fake_pdf)
    assert "spoofing" in exc_info.value.message.lower()


def test_dangerous_executable_extensions_rejected(validator):
    """Verify executable or dangerous extensions are rejected."""
    dangerous_files = ["malware.exe", "script.sh", "install.bat", "run.py", "eval.js"]
    for fname in dangerous_files:
        with pytest.raises(IngestionValidationError) as exc_info:
            validator.validate(fname, b"content")
        assert "prohibited" in exc_info.value.message.lower() or "not supported" in exc_info.value.message.lower()


def test_filename_sanitization(validator):
    """Verify path traversal sequences and control characters are stripped."""
    assert validator.sanitize_filename("../../etc/passwd.pdf") == "passwd.pdf"
    assert validator.sanitize_filename("..\\..\\windows\\system32\\calc.pdf") == "calc.pdf"
    assert validator.sanitize_filename("hello\x00world.txt") == "helloworld.txt"
