"""OCR Extractor using Pillow and Tesseract.

Provides image preprocessing, contrast enhancement, OCR text extraction,
confidence calculation, and graceful degradation when Tesseract is not installed.
"""

import io
import os
import shutil
from typing import Any, List, Optional, Tuple
from PIL import Image, ImageEnhance, ImageFilter

from app.core.logging import get_logger
from app.services.extractors.base import (
    BaseExtractor,
    DocumentExtractionResult,
    PageExtractionResult,
    estimate_token_count,
)

logger = get_logger("extractors.ocr")

# Common Windows install locations for Tesseract
TESSERACT_COMMON_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
]


def resolve_tesseract_binary() -> Optional[str]:
    """Find installed tesseract executable from PATH or common directories."""
    # 1. Environment variable override
    env_path = os.environ.get("TESSERACT_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path

    # 2. PATH resolution
    path_bin = shutil.which("tesseract")
    if path_bin and os.path.isfile(path_bin):
        return path_bin

    # 3. Known Windows directories
    for candidate in TESSERACT_COMMON_PATHS:
        if os.path.isfile(candidate):
            return candidate

    return None


class OCRExtractor(BaseExtractor):
    """OCR extraction engine for image files and scanned document pages."""

    def __init__(self) -> None:
        self.tesseract_cmd = resolve_tesseract_binary()
        self._available: Optional[bool] = None
        if self.tesseract_cmd:
            try:
                import pytesseract
                pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd
            except ImportError:
                pass

    def is_available(self) -> bool:
        """Check if Tesseract binary and Python binding are available."""
        if self._available is not None:
            return self._available
        if not self.tesseract_cmd:
            self._available = False
            return False
        try:
            import pytesseract
            # Verify executable works
            _ = pytesseract.get_tesseract_version()
            self._available = True
            return True
        except Exception:
            self._available = False
            return False

    def preprocess_image(self, pil_image: Image.Image) -> Image.Image:
        """Enhance image for OCR accuracy: grayscale, contrast enhancement, sharp filter."""
        # 1. Convert to grayscale
        if pil_image.mode != "L":
            gray = pil_image.convert("L")
        else:
            gray = pil_image.copy()

        # 2. Enhance contrast
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(1.6)

        # 3. Filter noise
        sharpened = enhanced.filter(ImageFilter.SHARPEN)
        return sharpened

    def extract_image_text_and_confidence(
        self,
        pil_image: Image.Image,
    ) -> Tuple[str, Optional[float], List[str]]:
        """Run OCR on a PIL image and return (text, avg_confidence, warnings)."""
        warnings: List[str] = []
        if not self.is_available():
            msg = "Tesseract OCR engine is not installed or not found on PATH. OCR extraction was skipped."
            warnings.append(msg)
            return "", None, warnings

        import pytesseract

        try:
            processed = self.preprocess_image(pil_image)
            text = pytesseract.image_to_string(processed).strip()

            # Calculate word-level confidence
            data = pytesseract.image_to_data(processed, output_type=pytesseract.Output.DICT)
            confidences: List[int] = []
            for conf in data.get("conf", []):
                try:
                    c_val = int(conf)
                    if c_val >= 0:  # -1 represents non-word blocks
                        confidences.append(c_val)
                except (ValueError, TypeError):
                    continue

            avg_conf = (
                round(float(sum(confidences) / len(confidences)), 2)
                if confidences
                else (75.0 if text else None)
            )
            return text, avg_conf, warnings

        except Exception as e:
            logger.warning("OCR processing error: %s", e)
            warnings.append(f"OCR error: {str(e)}")
            return "", None, warnings

    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        **kwargs: Any,
    ) -> DocumentExtractionResult:
        """Extract text from a standalone image file (PNG, JPG, TIFF, BMP)."""
        warnings: List[str] = []

        try:
            pil_image = Image.open(io.BytesIO(file_bytes))
        except Exception as e:
            return DocumentExtractionResult(
                total_pages=0,
                pages=[],
                warnings=[f"Failed to open image file: {str(e)}"],
                success=False,
                error_message=f"Invalid or corrupted image format: {str(e)}",
            )

        text, confidence, ocr_warnings = self.extract_image_text_and_confidence(pil_image)
        warnings.extend(ocr_warnings)

        ocr_applied = self.is_available() and bool(text)

        page = PageExtractionResult(
            page_number=1,
            content=text,
            token_count=estimate_token_count(text),
            has_images=True,
            ocr_applied=ocr_applied,
            ocr_confidence=confidence,
            warnings=ocr_warnings,
            metadata={
                "image_width": pil_image.width,
                "image_height": pil_image.height,
                "image_format": pil_image.format,
                "ocr_confidence": confidence,
            },
        )

        return DocumentExtractionResult(
            total_pages=1,
            pages=[page],
            document_metadata={
                "width": pil_image.width,
                "height": pil_image.height,
                "format": pil_image.format,
                "ocr_applied": ocr_applied,
            },
            warnings=warnings,
            success=True,
        )
