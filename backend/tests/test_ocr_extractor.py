"""Tests for OCR Extractor and Graceful Degradation.

Verifies image preprocessing, contrast enhancement, graceful fallback when
Tesseract binary is missing, and confidence calculation.
"""

import asyncio
from unittest.mock import MagicMock, patch
from PIL import Image, ImageDraw
import pytest

from app.services.extractors.ocr import OCRExtractor, resolve_tesseract_binary


def create_test_image(text: str = "UDIP TEST") -> bytes:
    """Create a simple in-memory PNG image."""
    import io
    img = Image.new("RGB", (200, 60), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 20), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_tesseract_binary_resolution():
    """Verify resolver returns string or None without crashing."""
    res = resolve_tesseract_binary()
    assert res is None or isinstance(res, str)


def test_ocr_preprocessing():
    """Verify contrast enhancement and sharpening pipeline."""
    extractor = OCRExtractor()
    img = Image.new("RGB", (100, 100), color=(128, 128, 128))
    processed = extractor.preprocess_image(img)
    assert processed.mode == "L"
    assert processed.size == (100, 100)


def test_ocr_degradation_when_tesseract_missing():
    """Verify graceful degradation when Tesseract executable is not present."""
    extractor = OCRExtractor()
    img_bytes = create_test_image()

    with patch.object(extractor, "is_available", return_value=False):
        res = asyncio.run(extractor.extract(img_bytes, "scan.png", "image/png"))
        assert res.success is True
        assert res.total_pages == 1
        assert res.pages[0].ocr_applied is False
        assert res.pages[0].ocr_confidence is None
        assert any("Tesseract" in w for w in res.warnings)


def test_ocr_mocked_success():
    """Verify successful OCR extraction when engine returns words and confidence."""
    extractor = OCRExtractor()
    img_bytes = create_test_image("CONFIDENTIAL REPORT")

    mock_pytesseract = MagicMock()
    mock_pytesseract.image_to_string.return_value = "CONFIDENTIAL REPORT"
    mock_pytesseract.image_to_data.return_value = {
        "conf": ["95", "96", "-1"],
    }

    with patch.object(extractor, "is_available", return_value=True):
        with patch.dict("sys.modules", {"pytesseract": mock_pytesseract}):
            res = asyncio.run(extractor.extract(img_bytes, "doc_scan.jpg", "image/jpeg"))
            assert res.success is True
            assert res.total_pages == 1
            assert res.pages[0].ocr_applied is True
            assert res.pages[0].content == "CONFIDENTIAL REPORT"
            assert res.pages[0].ocr_confidence == 95.5
