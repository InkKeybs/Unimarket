import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { LoaderIcon, toast } from "react-hot-toast";
import styles from "./GcashCheckout.module.scss";

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

function GcashCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { productId } = useParams();
  const [product, setProduct] = useState(location.state?.product || {});
  const [loadingProduct, setLoadingProduct] = useState(false);

  const [buyerName, setBuyerName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amount = useMemo(() => Number(product.pprice || 0), [product.pprice]);
  const formattedAmount = useMemo(
    () => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount),
    [amount]
  );

  const merchantName = process.env.REACT_APP_GCASH_ACCOUNT_NAME || "Your GCash account";
  const merchantNumber = process.env.REACT_APP_GCASH_NUMBER || "Replace with your GCash number";
  const merchantQrCodeUrl =
    process.env.REACT_APP_GCASH_QR_CODE_URL || "/gcash-qr.png";

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(receiptFile);
    setReceiptPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [receiptFile]);

  useEffect(() => {
    if (product?.pprice || product?.id) {
      return;
    }

    if (!productId) {
      return;
    }

    const tokenStr = localStorage.getItem("token");
    const token = tokenStr ? JSON.parse(tokenStr) : null;

    setLoadingProduct(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/prodData",
      data: { id: productId, token },
    })
      .then((response) => {
        const details = response.data?.details || {};
        setProduct({
          id: details.data?.id || details.data?._id || productId,
          pname: details.data?.pname || "Selected item",
          pprice: details.data?.pprice || 0,
          pimage: details.data?.pimage || "",
          sellerName: details.name || "Seller",
          sellerMail: details.mail || "",
        });
      })
      .catch(() => {
        toast.error("Unable to load product details for checkout");
      })
      .finally(() => {
        setLoadingProduct(false);
      });
  }, [product, productId]);

  const handleReceiptUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setReceiptFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Upload a receipt image file");
      event.target.value = "";
      return;
    }

    setReceiptFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!buyerName.trim()) {
      toast.error("Enter the buyer name");
      return;
    }

    if (!referenceNumber.trim()) {
      toast.error("Enter the GCash reference number");
      return;
    }

    if (!receiptFile) {
      toast.error("Upload the payment receipt before submitting");
      return;
    }

    const tokenStr = localStorage.getItem("token");
    const token = tokenStr ? JSON.parse(tokenStr) : null;
    if (!token) {
      toast.error("Please log in before submitting payment");
      return;
    }

    try {
      setSubmitting(true);
      const receiptImage = await fileToDataUrl(receiptFile);
      const mergedNote = [receiptNote.trim(), additionalNote.trim(), `Buyer: ${buyerName.trim()}`]
        .filter(Boolean)
        .join("\n");

      await axios({
        method: "post",
        baseURL: `${process.env.REACT_APP_BASEURL}`,
        url: "/api/payments/submit",
        data: {
          token,
          productId: product.id || productId,
          amount,
          referenceNumber,
          receiptImage,
          note: mergedNote,
        },
      });

      setSubmitting(false);
      toast.success("Receipt submitted and queued for verification");
      navigate("/");
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to submit payment";
      toast.error(message);
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.checkoutPage}>
      <div className={styles.checkoutGlow} aria-hidden="true" />
      <div className={styles.checkoutShell}>
        <header className={styles.heroCard}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>Third-party GCash payment</p>
            <h1>Scan the merchant QR, upload your receipt, then submit for verification.</h1>
            <p className={styles.heroCopy}>
              The buyer pays through the merchant QR code below. After payment, upload the
              receipt so the order can be manually verified before fulfillment.
            </p>
            <div className={styles.heroPills}>
              <span>Scan QR code</span>
              <span>Upload receipt</span>
              <span>Manual verification</span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Order total</p>
            <div className={styles.summaryAmount}>{formattedAmount}</div>
            <div className={styles.summaryMeta}>
              <span>Product</span>
              <strong>{product.pname || "Selected item"}</strong>
            </div>
            <div className={styles.summaryMeta}>
              <span>Seller</span>
              <strong>{product.sellerName || "Seller"}</strong>
            </div>
          </div>
        </header>

        <main className={styles.checkoutGrid}>
          <section className={styles.qrPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Step 1</p>
                <h2>Pay to the merchant QR code</h2>
              </div>
              <span className={styles.statusBadge}>GCash</span>
            </div>

            {loadingProduct ? (
              <div className={styles.loadingWrap}>
                <LoaderIcon />
              </div>
            ) : (
              <div className={styles.qrCard}>
                {merchantQrCodeUrl ? (
                  <img
                    src={merchantQrCodeUrl}
                    alt="Merchant GCash QR code"
                    className={styles.qrCodeImage}
                  />
                ) : (
                  <div className={styles.qrPlaceholder}>
                    <strong>Merchant QR code</strong>
                    <p>Set REACT_APP_GCASH_QR_CODE_URL to your third-party QR image.</p>
                  </div>
                )}

                <div className={styles.merchantBox}>
                  <div>
                    <span>GCash account name</span>
                    <strong>{merchantName}</strong>
                  </div>
                  <div>
                    <span>GCash number</span>
                    <strong>{merchantNumber}</strong>
                  </div>
                </div>
              </div>
            )}

            <ul className={styles.stepList}>
              <li>Open GCash and scan the merchant QR code.</li>
              <li>Send the exact amount shown on this page.</li>
              <li>Save the receipt and transaction reference number.</li>
            </ul>
          </section>

          <section className={styles.formPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Step 2</p>
                <h2>Upload receipt and submit</h2>
              </div>
            </div>

            <form className={styles.checkoutForm} onSubmit={handleSubmit}>
              <label className={styles.fieldGroup}>
                <span>Buyer name</span>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(event) => setBuyerName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </label>

              <label className={styles.fieldGroup}>
                <span>Reference number</span>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  placeholder="GCash transaction reference"
                />
              </label>

              <label className={styles.fieldGroup}>
                <span>Receipt upload</span>
                <input type="file" accept="image/*" onChange={handleReceiptUpload} />
              </label>

              {receiptPreview ? (
                <div className={styles.receiptPreviewFrame}>
                  <img
                    src={receiptPreview}
                    alt="Uploaded GCash receipt preview"
                    className={styles.receiptPreviewImage}
                  />
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setReceiptFile(null)}
                  >
                    Replace receipt
                  </button>
                </div>
              ) : (
                <div className={styles.receiptDropzoneHint}>
                  Upload a screenshot or photo of your payment receipt.
                </div>
              )}

              <label className={styles.fieldGroup}>
                <span>Receipt note</span>
                <textarea
                  rows="4"
                  value={receiptNote}
                  onChange={(event) => setReceiptNote(event.target.value)}
                  placeholder="Add the transaction date, amount sent, or any receipt details"
                />
              </label>

              <label className={styles.fieldGroup}>
                <span>Optional note</span>
                <textarea
                  rows="3"
                  value={additionalNote}
                  onChange={(event) => setAdditionalNote(event.target.value)}
                  placeholder="Add delivery instructions, pickup time, or a short message"
                />
              </label>

              <div className={styles.noticeBox}>
                Your receipt will be reviewed manually before the order is marked as paid.
              </div>

              <button type="submit" className={styles.submitButton} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit for verification"}
              </button>

              <Link to="/" className={styles.backLink}>
                Cancel and go back home
              </Link>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

export default GcashCheckout;