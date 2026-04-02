import { Link } from 'react-router-dom';

function PaymentSuccess() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-[0_24px_70px_-30px_rgba(16,185,129,0.45)] sm:p-10">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-500 bg-white text-5xl font-bold text-emerald-600">
          &#10003;
        </div>

        <h2 className="mt-6 text-4xl font-semibold tracking-tight text-emerald-900">Payment Successful</h2>
        <p className="mt-3 text-base text-emerald-800">Your tickets have been issued.</p>

        <div className="mt-8">
          <Link
            to="/home"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </section>
  );
}

export default PaymentSuccess;
