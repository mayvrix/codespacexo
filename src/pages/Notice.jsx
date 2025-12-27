import { useNavigate } from "react-router-dom";

export default function Notice() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-black text-white font-doto">

      {/* Notice Text */}
      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
        Public Access Required
      </h1>

      <p className="max-w-2xl text-gray-300 text-base md:text-lg leading-relaxed">
        To use this feature, you must create an account and be a part of{" "}
        <span className="text-white font-semibold">CODESPACEXO</span>.
        <br />
        Please sign up and log in to continue.
      </p>

      {/* Buttons */}
      <div className="flex gap-6 mt-28">

        {/* Join Button */}
        <button
          onClick={() => navigate("/signup")}
          className="font-doto font-bold px-12 py-4 md:px-32 md:py-3 rounded-full
          bg-gray-100 text-black text-xl md:text-xl lg:text-2xl transition
          pointer-events-auto border border-transparent
          hover:bg-transparent hover:text-white hover:border-white"
        >
          Join
        </button>

        {/* Leave Button */}
        <button
          onClick={() => navigate(-1)}
          className="font-doto font-bold px-12 py-4 md:px-32 md:py-3 rounded-full
          bg-transparent text-white text-xl md:text-xl lg:text-2xl transition
          border border-white hover:bg-white hover:text-black"
        >
          Leave
        </button>

      </div>
    </div>
  );
}
