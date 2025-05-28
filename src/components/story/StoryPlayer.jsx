"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getStoryById, toggleStoryFavorite, getStoryWithAudioById } from "@/firebase/firestore";
import { formatTime } from "@/utils/helpers";
import Button from "@/components/common/Button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ErrorMessage from "@/components/common/ErrorMessage";

/**
 * Component responsible for playing a story with audio controls.
 * 
 * @param {Object} props
 * @param {string} props.storyId - The ID of the story to fetch and play
 */
export default function StoryPlayer({ storyId }) {
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });
  const [isFavorite, setIsFavorite] = useState(false);
  const [audioError, setAudioError] = useState(null);

  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const { user } = useAuth();
  const router = useRouter();

  // Setup audio
  useEffect(() => {
    console.log("Audio URL:", story?.audioUrl);
    
    if (!story?.audioUrl) {
      console.log("Nenhuma URL de áudio fornecida");
      return;
    }

    // Limpar qualquer instância de áudio anterior
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }
    
    // Criar nova instância de áudio
    audioRef.current = new Audio(story.audioUrl);
    
    // Event listeners
    const handleLoadedMetadata = () => {
      console.log("Áudio carregado, duração:", audioRef.current.duration);
      setPlayerState((prev) => ({ 
        ...prev, 
        duration: audioRef.current.duration || 0 
      }));
      setAudioError(null); // Limpar erro anterior se áudio carregou
    };
    
    const handleEnded = () => {
      setPlayerState((prev) => ({ 
        ...prev, 
        isPlaying: false, 
        currentTime: 0 
      }));
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
    
    const handleError = (e) => {
      // Extrair informações úteis do erro sem tentar serializar o evento
      const errorInfo = {
        type: e.type,
        target: {
          error: audioRef.current?.error ? {
            code: audioRef.current.error.code,
            message: audioRef.current.error.message
          } : null,
          readyState: audioRef.current?.readyState,
          networkState: audioRef.current?.networkState,
          src: audioRef.current?.src
        }
      };
      
      console.error("Erro ao carregar áudio:", errorInfo);
      
      // Mensagem de erro mais específica baseada no código
      let errorMessage = "Não foi possível carregar o áudio desta história.";
      
      if (audioRef.current?.error) {
        switch (audioRef.current.error.code) {
          case 1: // MEDIA_ERR_ABORTED
            errorMessage = "Carregamento do áudio foi interrompido.";
            break;
          case 2: // MEDIA_ERR_NETWORK
            errorMessage = "Erro de rede ao carregar o áudio. Verifique sua conexão.";
            break;
          case 3: // MEDIA_ERR_DECODE
            errorMessage = "Erro ao decodificar o arquivo de áudio.";
            break;
          case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
            errorMessage = "Formato de áudio não suportado ou arquivo não encontrado.";
            break;
          default:
            errorMessage = "Erro desconhecido ao carregar o áudio.";
        }
      }
      
      setAudioError(errorMessage);
    };
    
    // Adicionar listeners de eventos
    audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.current.addEventListener("ended", handleEnded);
    audioRef.current.addEventListener("error", handleError);
    
    // Tentar pré-carregar o áudio
    audioRef.current.load();
    
    // Limpar quando o componente for desmontado ou audioUrl mudar
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audioRef.current.removeEventListener("ended", handleEnded);
        audioRef.current.removeEventListener("error", handleError);
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [story?.audioUrl]);

  useEffect(() => {
    console.log("story loaded:", story);
  }, [story]);

  // Load the story data
  useEffect(() => {
    const fetchStory = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!storyId) {
          throw new Error("ID da história não fornecido");
        }
        
        // Tente buscar a história com áudio
        const storyData = await getStoryWithAudioById(storyId);
        
        if (!storyData) {
          throw new Error('História não encontrada.');
        }
        
        console.log("story loaded:", storyData);
        setStory(storyData);
        setIsFavorite(storyData.isFavorite || false);
        
      } catch (err) {
        console.error("Erro ao carregar história:", err);
        setError(err.message || 'Falha ao carregar a história.');
      } finally {
        setLoading(false);
      }
    };
    
    if (storyId) fetchStory();
  }, [storyId]);

  // Play/pause toggle
  const togglePlayPause = () => {
    if (!audioRef.current || audioError) return;
    
    if (playerState.isPlaying) {
      // Pause
      audioRef.current.pause();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setPlayerState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      // Play
      const playPromise = audioRef.current.play();
      
      // Play pode retornar uma Promise
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Play iniciado com sucesso
            setPlayerState((prev) => ({ ...prev, isPlaying: true }));
            progressIntervalRef.current = setInterval(() => {
              if (audioRef.current) {
                setPlayerState((prev) => ({ 
                  ...prev, 
                  currentTime: audioRef.current.currentTime 
                }));
              }
            }, 100);
          })
          .catch((error) => {
            // Play falhou
            console.error("Erro ao iniciar reprodução:", error.message);
            setAudioError("Não foi possível reproduzir o áudio. Tente novamente.");
            setPlayerState((prev) => ({ ...prev, isPlaying: false }));
          });
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current && !isNaN(newTime)) {
      audioRef.current.currentTime = newTime;
      setPlayerState((prev) => ({ ...prev, currentTime: newTime }));
    }
  };

  const handleToggleFavorite = async () => {
    try {
      await toggleStoryFavorite(storyId, !isFavorite);
      setIsFavorite(!isFavorite);
    } catch (err) {
      console.error("Falha ao alternar favorito:", err);
    }
  };

  if (loading) return <LoadingSpinner fullScreen message="Carregando história..." />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Botão de voltar */}
      <button
        onClick={() => router.push('/my-stories')}
        className="mb-4 flex items-center text-gray-600 hover:text-gray-800 transition-colors"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 mr-2" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar para Minhas Histórias
      </button>

      <h1 className="text-3xl font-bold mb-4">{story.title}</h1>
      <button
        onClick={handleToggleFavorite}
        className={`mb-4 ${isFavorite ? "text-yellow-500" : "text-gray-400"}`}
      >
        {isFavorite ? "★ Remover dos Favoritos" : "☆ Adicionar aos Favoritos"}
      </button>

      {story.audioUrl ? (
        <div className="mb-6">
          {audioError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4">
              {audioError}
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Button onClick={togglePlayPause}>
                {playerState.isPlaying ? "Pausar" : "Reproduzir"}
              </Button>
              <input
                type="range"
                min="0"
                max={playerState.duration || 0}
                value={playerState.currentTime || 0}
                onChange={handleSeek}
                className="flex-1"
                disabled={!playerState.duration}
              />
              <span className="text-sm">
                {formatTime((playerState.currentTime || 0) * 1000)} / {formatTime((playerState.duration || 0) * 1000)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded-md mb-6">
          Esta história não possui narração de áudio.
        </div>
      )}

      <article className="prose prose-lg max-w-none">
        {story.content.split('\n\n').map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
      </article>
    </div>
  );
}